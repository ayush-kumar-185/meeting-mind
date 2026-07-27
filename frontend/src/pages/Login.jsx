import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Login() {
  console.log("ALL VITE ENV VARS:", import.meta.env);
  const handleGoogleLogin = () => {
    const BASE_URL = import.meta.env.VITE_API_URL;
    window.location.href = `${BASE_URL}/auth/google`;
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#f8f9ff] text-[#0b1c30]">
      <Card className="w-full max-w-md border border-[#ccc3d6]/30 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.05)]">
        <CardContent className="flex flex-col items-center text-center p-8 overflow-hidden">
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-[#5b21b6] rounded-lg flex items-center justify-center shadow-[0_4px_12px_rgba(91,33,182,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold text-[#5b21b6] tracking-tight">MeetingMind</h1>
          </div>
          
          <p className="text-lg text-[#4a4453] mb-10 max-w-[320px]">
            Otter transcribes your meetings. MeetingMind makes sure everything that was said actually gets done.
          </p>

          <Button 
            variant="outline"
            size="lg" 
            className="w-full h-auto py-3 px-6 bg-white border border-[#ccc3d6] hover:bg-[#eff4ff] hover:border-[#eff4ff] transition-colors duration-200 rounded-lg group gap-2" 
            onClick={handleGoogleLogin}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            <span className="text-sm font-semibold text-[#0b1c30] group-hover:text-[#5b21b6] transition-colors">Sign in with Google</span>
          </Button>

          <div className="mt-8 pt-6 border-t border-[#ccc3d6]/30 w-full text-center">
            <p className="text-sm text-[#4a4453]/70">
              Secure, enterprise-grade authentication.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}