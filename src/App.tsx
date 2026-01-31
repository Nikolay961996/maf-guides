import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Основной маршрут с ID */}
        <Route path="/maf/:id" element={<MainPage />} />
        {/* Резервный маршрут для корня */}
        <Route path="/" element={<MainPage />} />
        {/* Любой другой маршрут ведет на главную */}
        <Route path="*" element={<MainPage />} />
      </Routes>
    </Router>
  );
}

export default App;
