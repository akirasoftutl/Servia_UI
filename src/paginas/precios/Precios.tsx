import { useNavigate } from 'react-router';
import './Precios.css';

export const Precios = () => {
  const navigate = useNavigate();
  

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/login');
  }; 

  return (
    <>
 <section className="pricing-container">
      <header className="pricing-header">
        <h1 className="pricing-title">
          Un <span className="hero__title-highlight">software</span> que se
          <br />
          adapta a ti
        </h1>
        <p className="pricing-subtitle">
          A medida que te expandes, cobramos por cada miembro del equipo que se pueda
          <br />
          reservar
        </p>
      </header>

      <div className="pricing-cards">
        <div className="pricing-card-wrapper">
          <div className="card-image-box">
            <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=600&auto=format&fit=crop" alt="Independiente preview" />
          </div>
          <article className="pricing-card">
            <div className="card-top">
              <div className="card-title-row">
                <h2 className="card-title">Independiente</h2>
                <span className="trial-badge">7 días de prueba</span>
              </div>

              <div className="card-price">239,95 MXN</div>
              <p className="card-period">por mes</p>

              <div className="card-features-block">
                <h3 className="features-heading">Incluye</h3>
                <ul className="features-list">
                  <li>Una sola columna en el calendario</li>
                  <li>20 mensajes gratis</li>
                  <li>50 correos electrónicos de marketing gratis</li>
                  <li>Soporte por email y chat</li>
                </ul>
              </div>
            </div>

            <div className="card-footer">
              <button type='button' className="cta-button" onClick={handleLoginClick}>
                Comenzar ahora
              </button>
            </div>
          </article>
        </div>

        <div className="pricing-card-wrapper image-right">
          <article className="pricing-card">
            <div className="card-top">
              <div className="card-title-row">
                <h2 className="card-title">Equipo</h2>
                <span className="trial-badge">7 días de prueba</span>
              </div>

              <div className="card-price">159,95 MXN</div>
              <p className="card-period">por miembro del equipo, al mes</p>

              <div className="card-features-block">
                <h3 className="features-heading">Incluye</h3>
                <ul className="features-list">
                  <li>Múltiples columnas de calendario</li>
                  <li>20 mensajes gratis por miembro del equipo</li>
                  <li>50 correos electrónicos de marketing gratuitos por miembro del equipo</li>
                  <li>Soporte por teléfono, email y chat</li>
                </ul>
              </div>
            </div>

            <div className="card-footer">
              <button type='button' className="cta-button" onClick={handleLoginClick}>
                Comenzar ahora
              </button>
            </div>
          </article>
          <div className="card-image-box">
            <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=600&auto=format&fit=crop" alt="Equipo preview" />
          </div>
        </div>
      </div>
    </section>

    <section className="compare-container">
      <h2 className="compare-main-title">Comparar planes</h2>

      <div className="compare-table-wrapper">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="col-feature-header"></th>
              <th className="col-plan-header">
                <span className="plan-name">Independiente</span>
                <span className="plan-desc">Negocios unipersonales</span>
              </th>
              <th className="col-plan-header">
                <span className="plan-name">Equipo</span>
                <span className="plan-desc">Negocios con varios miembros del equipo</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="row-label">Suscripción</td>
              <td className="row-value">239,95 MXN al mes</td>
              <td className="row-value">
                159,95 MXN al mes
                <span className="sub-text">Por miembro del equipo que se puede reservar <span className="info-icon" title="Más información">ⓘ</span></span>
              </td>
            </tr>
            <tr>
              <td className="row-label">Miembros del equipo</td>
              <td className="row-value">1</td>
              <td className="row-value">Ilimitado</td>
            </tr>
            <tr>
              <td className="row-label">Múltiples ubicaciones comerciales</td>
              <td className="row-value check-mark">✓</td>
              <td className="row-value check-mark">✓</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section className="cta-banner-container">
      <div className="cta-banner-content">
        <h2 className="cta-banner-title">No pierdas más tiempo</h2>
        <p className="cta-banner-subtitle">Asóciate con Servia y comienza a hacer crecer tu negocio hoy mismo</p>
        
        <button type="button" className="cta-banner-button">
          Empezar hoy 
        </button>
      </div>
    </section>
    </>
  );
};

export default Precios;