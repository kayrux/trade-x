import { Home, User } from 'lucide-react';
import SearchBar from '../../forms/SearchBar/SearchBar';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar__left">
        <button className="navbar__icon-btn" aria-label="Home">
          <Home size={22} />
        </button>
      </div>
      <div className="navbar__center">
        <SearchBar />
      </div>
      <div className="navbar__right">
        <button className="navbar__icon-btn" aria-label="Account">
          <User size={22} />
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
