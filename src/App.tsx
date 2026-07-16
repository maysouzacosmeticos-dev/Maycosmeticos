import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Storefront from './Storefront';
import Admin from './Admin';
import Login from './Login';
import PDV from './PDV';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pdv" element={<PDV />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
