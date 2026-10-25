import './Home.css'

function Home() {
  const features = [
    {
      title: "Administra",
      description: "Administra fácilmente tus reservas, ventas, clientes, centros y miembros del equipo. Analiza el rendimiento de tu negocio con informes y datos avanzados."
    },
    {
      title: "Crece",
      description: "Consigue nuevos clientes en el mercado de belleza y bienestar más grande del mundo. Haz que regresen con funciones de marketing."
    },
    {
      title: "Recibe pagos",
      description: "Acepta pagos rápidamente con un sistema sencillo y seguro. Reduce las inasistencias con pagos anticipados y simplifica el proceso de venta."
    }
  ];

  const categories = [
    { 
      title: 'Barberías Masculino', 
      img: './galeria_home/galeria_1.jpg' 
    },
    { 
      title: 'Gimnasios Tradicionales', 
      img: './galeria_home/galeria_2.jpg' 
    },
    { 
      title: 'Salones de Uñas',
      img: './galeria_home/galeria_3.jpg' 
    },
    { 
      title: 'Salones de Depilación ', 
      img: './galeria_home/galeria_4.jpeg' 
    },
    { 
      title: 'Estudios de Yoga y Pilates', 
      img: './galeria_home/galeria_5.jpeg' 
    },
    { 
      title: 'Maquillaje Profesional', 
      img: './galeria_home/galeria_6.webp' 
    },
    { 
      title: 'Spas y Centros de Relajación', 
      img: './galeria_home/galeria_7.jpg' 
    },
    { 
      title: 'Tratamientos Capilares', 
      img: './galeria_home/galeria_8.jpg' 
    },
    { 
      title: 'Academias de Danza, Baile', 
      img: './galeria_home/galeria_9.jpeg' 
    },
  ];
  
  const benefits = [
    "Calendario potente con número ilimitado de citas, clientes y sucursales, y mucho más",
    "Información avanzada que ofrece una visión integral de cada cliente, incluidos sus comportamientos de reservación, preferencias, formas de pago y canales de marketing preferidos, además de su valor de vida y mucho más.",
    "Diseño sencillo que mejora la experiencia, potencia tu negocio y fortalece tu marca"
  ];

  return (
    <>
    <section className="platform-section">
     
      <div className="platform__header">
        <h2>Una <span className="hero__title-highlight">plataforma</span>, infinitas posibilidades</h2>
        <p>
          Todo lo que necesitas para crecer y prosperar. Servia ofrece numerosas herramientas para aumentar las ventas, 
          administrar tu calendario y retener a los clientes, así puedes concentrarte en lo que mejor sabes hacer.
        </p>
        <a href="#registro" className="btn btn--dark">
          Empezar hoy 
        </a>
      </div>

      <div className="platform__grid">
        {categories.map((item, index) => (
          <div key={index} className="platform__card">
            <img src={item.img} alt={item.title} />
            <div className="platform__card-overlay" />
            <span className="platform__card-title">{item.title}</span>
          </div>
        ))}
      </div>
    </section>

    <section className="admin-features-section">
      <div className="admin-features__container">
      
        <div className="admin-features__header">
          <h2>Todo lo que necesitas para administrar tus negocios</h2>
          <p>
            Servia pone a tu disposición herramientas innovadoras para ofrecer comodidad, eficiencia y una experiencia mejorada tanto para tu equipo como para tus clientes.
          </p>
        </div>

        <div className="admin-features__grid">
          {features.map((item, index) => (
            <div key={index} className="admin-features__card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

     <section className="hero-section">
      <div className="hero__container">
        <div className="hero__content">
          <h1 className="hero__title">
            <span className="hero__title-highlight">Software</span> todo en uno para administrar tu negocio
          </h1>
          
          <p className="hero__subtitle">
            El software de reservas preferido y mejor valorado por salones de belleza, spas y negocios del sector de la belleza y el bienestar
          </p>

          <ul className="hero__list">
            {benefits.map((text, index) => (
              <li key={index} className="hero__list-item">
                <svg 
                  className="hero__check-icon" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="hero__visuals">
          <div className="hero__mockup-wrapper">
            <div className="hero__card hero__card--front">
              <div className="profile-card">
                <div className="profile-card__avatar-wrap">
                  <img 
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" 
                    alt="Sarah Curtis" 
                    className="profile-card__avatar"
                  />
                </div>
                <h3 className="profile-card__name">
                  Sarah Curtis 
                  <span className="badge-check">✓</span>
                </h3>
                <div className="profile-card__gallery">
                  <img src="https://images.unsplash.com/photo-1632345031435-8727f6c97d34?auto=format&fit=crop&w=150&q=80" alt="Nails 1" />
                  <img src="https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=150&q=80" alt="Nails 2" />
                </div>
                <div className="profile-card__section">
                  <h4>Basics and interests</h4>
                  <div className="tags-grid">
                    <span className="tag">⚡ Scorpio</span>
                    <span className="tag">👑 She/her</span>
                    <span className="tag">🌈 LGBTQ+</span>
                    <span className="tag">✨ Active</span>
                    <span className="tag">🔮 Spiritualist</span>
                  </div>
                  <h4 style={{ marginTop: '12px' }}>Interests</h4>
                  <div className="tags-grid">
                    <span className="tag">⚽ Football</span>
                    <span className="tag">🐶 Dogs</span>
                    <span className="tag">🎵 Pop Music</span>
                    <span className="tag">🧁 Baking</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta Móvil 2 (Calendario de citas) */}
            <div className="hero__card hero__card--back">
              <div className="calendar-card">
                <div className="calendar-card__header">
                  <div className="user-pill">
                    <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" alt="Mitchell" />
                    <span>Mitchell</span>
                  </div>
                  <div className="user-pill active">
                    <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" alt="Sarah" />
                    <span>Sarah</span>
                  </div>
                  <div className="user-pill">
                    <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80" alt="Danny" />
                    <span>Danny</span>
                  </div>
                </div>

                <div className="calendar-card__grid">
                  <div className="time-row">
                    <span className="time-label">10:00 am</span>
                    <div className="event event--yellow">
                      <strong>10:15 - 11:00</strong>
                      <p>Amy</p>
                      <small>Hair touchup</small>
                    </div>
                    <div className="event event--blue">
                      <strong>10:15 - 11:00</strong>
                      <p>John</p>
                      <small>Beard trim</small>
                    </div>
                    <div className="event event--green">
                      <strong>10:15 - 11:00</strong>
                      <p>Lucy</p>
                      <small>Hair color</small>
                    </div>
                  </div>

                  <div className="time-row">
                    <span className="time-label">10:00 am</span>
                    <div className="event event--pink">
                      <strong>10:15 - 11:00</strong>
                      <p>Felix</p>
                      <small>Hair touchup</small>
                    </div>
                  </div>

                  <div className="time-row">
                    <span className="time-label">10:00 am</span>
                    <div className="event event--teal">
                      <strong>10:15 - 11:00</strong>
                      <p>Zach</p>
                      <small>Swedish Massage</small>
                    </div>
                    <div className="event event--purple">
                      <strong>10:15 - 11:00</strong>
                      <p>Alex</p>
                      <small>Haircut</small>
                    </div>
                  </div>
                </div>

                <div className="calendar-card__footer">
                  <div className="nav-btn">📅</div>
                  <div className="nav-btn">💲</div>
                  <div className="nav-btn nav-btn--plus">+</div>
                  <div className="nav-btn">😊</div>
                  <div className="nav-btn">㗊</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </>  
);
}

export default Home;