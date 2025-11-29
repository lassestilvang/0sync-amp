import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        navigate('/integrations');
        return;
      }

      if (code && state) {
        // The OAuth callback is handled by the backend
        // This page is just for reference - actual callback goes to /oauth/:provider/callback
        navigate('/integrations');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-lg text-gray-600">Completing integration setup...</p>
      </div>
    </div>
  );
}
