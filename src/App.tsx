import { Routes, Route } from 'react-router-dom';
import SidebarLayout from './layouts/SidebarLayout';
import Home from './pages/Home';
import GameList from './pages/games/GameList';
import Game2048 from './pages/games/Game2048';
import Snake from './pages/games/Snake';
import Tetris from './pages/games/Tetris';
import Minesweeper from './pages/games/Minesweeper';
import GuideList from './pages/guides/GuideList';
import GameGuides from './pages/guides/GameGuides';
import GuideDetail from './pages/guides/GuideDetail';
import ToolList from './pages/tools/ToolList';
import Calculator from './pages/tools/Calculator';
import ColorConverter from './pages/tools/ColorConverter';
import MahjongHu from './pages/tools/MahjongHu';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<SidebarLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/games" element={<GameList />} />
        <Route path="/games/2048" element={<Game2048 />} />
        <Route path="/games/snake" element={<Snake />} />
        <Route path="/games/tetris" element={<Tetris />} />
        <Route path="/games/minesweeper" element={<Minesweeper />} />
        <Route path="/guides" element={<GuideList />} />
        <Route path="/guides/game/:gameName" element={<GameGuides />} />
        <Route path="/guides/:slug" element={<GuideDetail />} />
        <Route path="/tools" element={<ToolList />} />
        <Route path="/tools/calculator" element={<Calculator />} />
        <Route path="/tools/color-converter" element={<ColorConverter />} />
        <Route path="/tools/mahjong-hu" element={<MahjongHu />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
