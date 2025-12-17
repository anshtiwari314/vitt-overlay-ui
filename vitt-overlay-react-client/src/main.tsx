import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import store from './redux/store/store.tsx'
import { Provider as ReduxProvider} from 'react-redux'
import { VadWrapper } from './context/VadWrapper.tsx'
import { DataWrapper } from './context/DataWrapper.tsx'
import Login2 from './pages/Login2.tsx'
import AuthContext from './context/AuthContext.tsx'
import Routing from './Routing.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReduxProvider store={store}>
      <AuthContext>
        <Routing/>
      </AuthContext>
    </ReduxProvider>
  </StrictMode>,
)
