import React, { useState } from 'react';
import { useTheme } from './ThemeContext';
import './LoginPage.css';

function LoginPage({ onLogin }) {
  const [isHovered, setIsHovered] = useState(false);
  const { isDarkMode } = useTheme();
  
  const defaultIcon = 'https://res.cloudinary.com/doznvxtja/image/upload/v1768508628/Sign_in_with_Intercom_2_ebtg4q.svg';
  const hoverIcon = 'https://res.cloudinary.com/doznvxtja/image/upload/v1768509801/Sign_in_with_Intercom_6_sagtwp.svg';
  const darkModeSvg = 'https://res.cloudinary.com/doznvxtja/image/upload/v1768692943/Sign_in_with_Intercom_7_mhnwpi.svg';

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1>
            {isDarkMode ? (
              <img 
                src={darkModeSvg}
                alt="Queue Health Monitor" 
                className="login-title-image login-darkmode-svg"
              />
            ) : (
              <img 
                src="https://res.cloudinary.com/doznvxtja/image/upload/v1768508347/Sign_in_with_Intercom_kjclvw.svg" 
                alt="Queue Health Monitor" 
                className="login-title-image"
              />
            )}
          </h1>
          <p className="login-description">
            Please authenticate with your Intercom credentials to access the dashboard.
          </p>
          <button 
            className="login-button" 
            onClick={onLogin}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            Sign in with Intercom{' '}
            <img 
              src={isHovered ? hoverIcon : defaultIcon}
              alt="Intercom logo" 
              className="login-button-icon"
            />
          </button>
          <p className="login-help">
            You'll be redirected to Intercom to sign in securely.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
