import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__brand-col">
          <a href="/" className="footer__logo">
            Servia
          </a>
          <a href="#descarga" className="footer__download-btn">
            <span>Descarga la app</span>
            <div className="footer__download-icons ">
            <img src='./logo_and.png' className='imagen'/> 
            </div>
          </a>
        </div>

        <div className="footer__links-grid">
          <div className="footer__col">
            <h4>Acerca de Servia</h4>
            <ul>
              <li><a href="#carreras">Carreras</a></li>
              <li><a href="#ayuda">Ayuda y soporte</a></li>
              <li><a href="#blog">Blog</a></li>
              <li><a href="#mapa">Mapa del sitio</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Para empresas</h4>
            <ul>
              <li><a href="#socios">Para socios</a></li>
              <li><a href="#precios">Precios</a></li>
              <li><a href="#caracteristicas">Características</a></li>
              <li><a href="#programacion">Programación</a></li>
              <li><a href="#pos">Punto de venta</a></li>
              <li><a href="#connect">Servia Connect</a></li>
              <li><a href="#reputacion">Reputación Online</a></li>
              <li><a href="#marketplace">Marketplace</a></li>
              <li><a href="#soporte">Soporte</a></li>
              <li><a href="#estado">Estado</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Legal</h4>
            <ul>
              <li><a href="#privacidad">Política de privacidad</a></li>
              <li><a href="#terminos">Términos de servicio</a></li>
              <li><a href="#uso">Términos de uso</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Encuéntranos en redes sociales</h4>
            <ul className="footer__social-list">
              <li>
                <a href="#facebook" target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              </li>
              <li>
                <a href="#linkedin" target="_blank" rel="noopener noreferrer">
                  Linkedin
                </a>
              </li>
              <li>
                <a href="#instagram" target="_blank" rel="noopener noreferrer">
                  Instagram 
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="footer__language">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span>español (MX)</span>
        </div>
        <div className="footer__copyright">
          © 2026 Servia.com SV Ltd.
        </div>
      </div>
    </footer>
  );
}
