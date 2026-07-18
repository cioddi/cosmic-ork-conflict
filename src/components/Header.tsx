import "./Header.css";

export default function Header() {
  return (
    <div className="cosmic-banner" aria-label="Intergalactic Cosmic Ork Conflict — barbaric">
      <div className="cosmic-banner__scanlines" aria-hidden="true" />
      <div className="cosmic-banner__eyebrow">
        <span>Intergalactic</span>
        <i aria-hidden="true" />
        <span>Ch. 84</span>
      </div>
      <div className="cosmic-banner__title" aria-hidden="true">
        <span>Cosmic</span>
        <strong>Ork</strong>
        <span>Conflict</span>
      </div>
      <div className="cosmic-banner__tag" aria-hidden="true">
        <span>Barbaric</span>
        <b>Deep-space warfare</b>
      </div>
    </div>
  );
}
