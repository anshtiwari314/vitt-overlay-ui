
import {DataWrapper} from './context/DataWrapper';
import {VadWrapper}  from './context/VadWrapper';
import { useEffect } from 'react';
//import App from './App';

import { useDispatch } from 'react-redux';


import PrivateRoute from './components/PrivateRoute'
import GlobalRoute from './components/GlobalRoute'

import Login2 from './pages/Login2'

import {HashRouter as Router ,Routes,Route} from 'react-router-dom'
import { useAuth } from './context/AuthContext';
import {v4 as uuidv4} from 'uuid'
import App from './App';

//import './css/All.css'
//import './css/msg.css'


export default function Routing(){
  
    const dispatch = useDispatch();
  const {currentUser,setCurrentUser,isAuthenticated,setIsAuthenticated}= useAuth()
  

//   useEffect(()=>{
//   let insuranceAuthKey = JSON.parse(localStorage.getItem('insurance-auth'))
//   //console.log('routing',insuranceAuthKey.userid)
//   if(insuranceAuthKey && insuranceAuthKey.userid){

//     //console.log('routing',insuranceAuthKey.userid)
//     setCurrentUser({userid:insuranceAuthKey.userid,sessionuid:uuidv4()})
    
//   }
//   setIsAuthenticated(true)
//   },[]) 

  //console.log('currentUser',currentUser,isAuthenticated)

//   if(!isAuthenticated){
//     return null
//   }
  return (
    <Router>
      <Routes>
            {/* @ts-ignore */}
            <Route path='/' element={<GlobalRoute component={<Login2/>}/>}/>
           
            {/* <Route path='/signup' element={<PrivateRoute component={<SignIn/>}/>}/> */}
            {/* @ts-ignore */}
          
            <Route path='/app' element={<PrivateRoute component={
                 <DataWrapper>
                    <VadWrapper>
                        <App />
                        {/* <div>hello world</div> */}
                    </VadWrapper>
                </DataWrapper>
            }/>}/>
      </Routes>
    </Router>
  )
}