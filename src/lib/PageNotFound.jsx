import { Link, useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sky-gradient">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light nebula-text font-space">404</h1>
            <div className="h-0.5 w-16 bg-star-gold/30 mx-auto" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-foreground font-space">
              Page Not Found
            </h2>
            <p className="text-muted-foreground leading-relaxed font-inter">
              The page <span className="font-medium text-foreground">"{pageName}"</span> could not be found.
            </p>
          </div>

          <div className="pt-6">
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-star-gold glass-dark border border-star-gold/30 rounded-xl hover:border-star-gold/50 transition-colors font-space"
            >
              Return to Sky
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
