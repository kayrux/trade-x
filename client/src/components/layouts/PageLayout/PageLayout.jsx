import Navbar from '../Navbar/Navbar';
import Sidebar from '../Sidebar/Sidebar';
import './PageLayout.css';

function PageLayout({ children }) {
  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-layout__main">
        <Navbar />
        <main className="page-layout__content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default PageLayout;
