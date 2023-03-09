import logo from './logo.svg';
import './App.css';
import React from 'react';
import * as Realm from "realm-web";
import axios from 'axios';
const appId = process.env.REACT_APP_APP_ID;
const appRegion = process.env.REACT_APP_APP_REGION;
const app = new Realm.App({ id: appId });
const appUrl = `https://${appRegion}.data.mongodb-api.com/app/${app.id}`;

// Component to display the main details and allow log out
function UserDetail({ user, hostEnvInfo, firstSavedPerson, setUser }) {
  const loginOut = async () => {
    await user.logOut();
    setUser(null);
  };

  return (
    <div>
      <h1>Logged in with anonymous id: {user.id}</h1>
      <h2>Functions host IP address is: {hostEnvInfo?.runtimeIPAddress}</h2>
      <h2>
        First person's info from database:&nbsp;
        {firstSavedPerson?.firstName} {firstSavedPerson?.lastName}&nbsp;
        (DOB: {firstSavedPerson?.dateOfBirth}        
      </h2>
      <h2><button onClick={loginOut}>Log Out</button></h2>
    </div>
  );
}

// Component to perform anonymous user log in
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

function App() {
  const [user, setUser] = React.useState(app.currentUser);
  const [hostEnvInfo, setHostEnvInfo] = React.useState({});
  const [firstSavedPerson, setFirstSavedPerson] = React.useState({});

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {user ? <UserDetail user={user} hostEnvInfo={hostEnvInfo} firstSavedPerson={firstSavedPerson} setUser={setUser} />
              : <Login setUser={setUser} setHostEnvInfo={setHostEnvInfo} setFirstSavedPerson={setFirstSavedPerson}/>}
      </header>
    </div>
  );
}

export default App;
