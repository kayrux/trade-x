import './ResolutionSwitcher.css';

function ResolutionSwitcher({ resolution, onChange, options }) {
  return (
    <div className="resolution-switcher">
      {options.map(opt => (
        <button
          key={opt}
          className={`resolution-switcher__btn${resolution === opt ? ' resolution-switcher__btn--active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default ResolutionSwitcher;
