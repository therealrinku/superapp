import { useContext } from 'react';
import { RootContext } from '../context/RootContext';
import { IApp } from '../global';

export default function useSuperApp() {
  const { app , setApp} = useContext(RootContext);

  function loadApp(appName:IApp) {
    setApp(appName)
  }

  return { app, loadApp};
}
