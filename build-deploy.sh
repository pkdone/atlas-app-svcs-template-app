#!/bin/bash
ROOT_FOLDER=$(pwd)
rm -rf build/* tmp/* front-end/build/*

# Load environment variables from '.env' file
source .env

# Update dependency packages
npm install && npm --prefix back-end install back-end && npm --prefix deploy-tools install deploy-tools && npm --prefix front-end install front-end

# Initialise the DB with required data and indexes
npm run initdb || exit 1

# Build back-end (converting Node.js funcs to app services funcs)
npm run build || exit 1

# Login to the App Services project runtime
realm-cli login -y --api-key="${ATLAS_ADMIN_API_PROJECT_PUBLIC_KEY}" --private-api-key="${ATLAS_ADMIN_API_PROJECT_PRIVATE_KEY}"

# Undeploy old app (if it exists)
cd ${ROOT_FOLDER}/build
realm-cli apps delete --app="${APP_NAME}" -y
printf "^ Ignore 'app delete failed' errors here if the app was not previously deployed\n"

# Deploy skeleton version of the app back-end
realm-cli push -y
printf "^ Ignore 'push failed' errors here because these will be fixed by a subsequent push\n"

# Upload some 'standard' secrets
realm-cli secrets create --app="${APP_NAME}" --name ATLAS_ADMIN_API_PROJECT_PUBLIC_KEY_SECRET --value "${ATLAS_ADMIN_API_PROJECT_PUBLIC_KEY}"
realm-cli secrets create --app="${APP_NAME}" --name ATLAS_ADMIN_API_PROJECT_PRIVATE_KEY_SECRET --value "${ATLAS_ADMIN_API_PROJECT_PRIVATE_KEY}"
realm-cli secrets create --app="${APP_NAME}" --name DB_NAME_SECRET --value "${DB_NAME}"

# Upload 'custom' secrets required by the app
for secret in "${SECRETS_LIST[@]}"; do
	printf "Custom secret '${secret}_SECRET': "
  realm-cli secrets create --app="${APP_NAME}" --name "${secret}_SECRET" --value "${secret}"
done

# Deploy full version of the app back-end
realm-cli push --include-package-json -y || exit 1

# Enable virtual hosting and print the app's URL
realm-cli function run --app="${APP_NAME}" --name PUB_enableAppVirtualHosting

# Get metadata and construct the front end's requried .env.local file with it
cd ${ROOT_FOLDER}
APP_METADATA=$(realm-cli function run --app="${APP_NAME}" --name PUB_getDeployedAppMetadata | tail -n +2) 
APP_ID=$(echo ${APP_METADATA} | jq '. | .appId')
REGION=${APP_SVCS_DEPLOY_REGION#*-} && PROVIDER=${APP_SVCS_DEPLOY_REGION%-"$REGION"}
printf "REACT_APP_APP_ID=${APP_ID}\nREACT_APP_APP_REGION=\"${REGION}.${PROVIDER}\"" > front-end/.env.local

# Build front-end
cd ${ROOT_FOLDER}/front-end
npm run build
cp -R build/* ../build/hosting/files
cd ${ROOT_FOLDER}/build

# Deploy full app version including the front-end
realm-cli push -y -s -c || exit 1
cd ${ROOT_FOLDER}

# Print the app's URL
realm-cli function run --app="${APP_NAME}" --name PUB_getAppVirtualHostingURL
printf "\nIt may take a few minutes for DNS to update for the URL above to be accessible\n"
