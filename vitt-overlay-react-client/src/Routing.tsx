import { HashRouter as Router, Route, Routes } from 'react-router-dom'
import App from './App'
import GlobalRoute from './components/GlobalRoute'
import PrivateRoute from './components/PrivateRoute'
import { DataWrapper } from './context/DataWrapper'
import { VadWrapper } from './context/VadWrapper'
import Login2 from './pages/Login2'

export default function Routing() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GlobalRoute component={<Login2 />} />} />
        <Route
          path="/app"
          element={
            <PrivateRoute
              component={
                <DataWrapper>
                  <VadWrapper>
                    <App />
                  </VadWrapper>
                </DataWrapper>
              }
            />
          }
        />
      </Routes>
    </Router>
  )
}
