import logo from './logo.svg';
import './App.css';
import React from 'react';
import * as Realm from "realm-web";
import axios from 'axios';
const appId = process.env.REACT_APP_APP_ID;
const appRegion = process.env.REACT_APP_APP_REGION;
const app = new Realm.App({ id: appId });
const appUrl = `https://${appRegion}.data.mongodb-api.com/app/${app.id}`;

// Create a component that displays the given user's details
function UserDetail({ user }) {
  return (
    <div>
      <h1>Logged in with anonymous id: {user.id}</h1>
    </div>
  );
}

// Create a component that lets an anonymous user log in
function Login({ setUser, setHostEnvInfo, setFirstSavedPerson }) {
  const loginAnonymous = async () => {
    const user = await app.logIn(Realm.Credentials.anonymous());
    setUser(user);
    const hostEnvInfo = await user.callFunction("PUB_getHostEnv");
    setHostEnvInfo(hostEnvInfo);

    try {
      const resp = await axios.get(`${appUrl}/endpoint/personInfo?personId=1`);
      setFirstSavedPerson(resp.data.results);
    } catch (error) {
      console.error(error);
    }
  };
  return <button onClick={loginAnonymous}>Log In</button>;
}

// Show functions host ip address
function HostIPAddress({ hostEnvInfo }) {
  return (
    <div>
      <h2>Functions host IP address is: {hostEnvInfo?.runtimeIPAddress}</h2>
    </div>
  );
}

// Show first person listed in in back end database collection
function FirstPersonInfo({ firstSavedPerson }) {
  return (
    <div>
      <h2>First person's info from database: {firstSavedPerson?.firstName} {firstSavedPerson?.lastName} (DOB: {firstSavedPerson?.dateOfBirth})</h2>
    </div>
  );
}


function App() {
  // Keep the logged in Realm user in local state. This lets the app re-render
  // whenever the current user changes (e.g. logs in or logs out).
  const [user, setUser] = React.useState(app.currentUser);
  const [hostEnvInfo, setHostEnvInfo] = React.useState({});
  const [firstSavedPerson, setFirstSavedPerson] = React.useState({});

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          {user ? <UserDetail user={user} /> : <Login setUser={setUser} setHostEnvInfo={setHostEnvInfo} setFirstSavedPerson={setFirstSavedPerson}/>}
          {hostEnvInfo ? <HostIPAddress hostEnvInfo={hostEnvInfo} /> : {}} 
          {firstSavedPerson ? <FirstPersonInfo firstSavedPerson={firstSavedPerson} /> : {}} 
        </p>
      </header>
    </div>
  );
}

export default App;
