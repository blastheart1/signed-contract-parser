'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const REMEMBER_ME_KEY = 'remembered_username';
const REMEMBER_ME_CHECKED_KEY = 'remember_me_checked';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load remembered username on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rememberedUsername = localStorage.getItem(REMEMBER_ME_KEY);
      const rememberMeChecked = localStorage.getItem(REMEMBER_ME_CHECKED_KEY) === 'true';
      
      if (rememberedUsername) {
        setUsername(rememberedUsername);
      }
      if (rememberMeChecked) {
        setRememberMe(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid username or password');
        setLoading(false);
        return;
      }

      // Handle "Remember Me" functionality
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, username);
          localStorage.setItem(REMEMBER_ME_CHECKED_KEY, 'true');
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
          localStorage.removeItem(REMEMBER_ME_CHECKED_KEY);
        }
      }

      // Small delay to allow browser to show password save prompt
      // Browsers typically show the prompt after successful form submission
      // but before navigation occurs
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect based on role
      if (data.user.role === 'admin') {
        router.push('/admin');
      } else if (data.user.role === 'vendor') {
        router.push('/dashboard/vendor-negotiation');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: 'url(/calimingo-pattern-bg.png)',
        backgroundSize: 'auto',
        backgroundPosition: '50% 0%',
        backgroundRepeat: 'repeat',
        backgroundAttachment: 'scroll',
        backgroundColor: 'rgb(35, 47, 71)'
      }}
    >
      {/* Go Back Button */}
      <Link 
        href="/" 
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 bg-white/80 hover:bg-white/90 backdrop-blur-sm border border-[rgb(36,47,71)]/30"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </motion.div>
      </Link>

      {/* Logo */}
      <div className="mb-8 z-10">
        <Image
          src="/cali-logo.svg"
          alt="Calimingo Pools"
          width={280}
          height={93}
          priority
          className="w-auto h-auto max-w-[280px] sm:max-w-[320px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-primary p-3">
                <Lock className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle 
              className="text-2xl text-center font-bold uppercase" 
              style={{ 
                fontFamily: 'Oswald, sans-serif',
                color: 'rgb(36, 47, 71)'
              }}
            >
              Sign in to your account
            </CardTitle>
            <CardDescription 
              className="text-center"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Enter your username and password to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form 
              onSubmit={handleSubmit} 
              method="post"
              className="space-y-4"
            >
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username" style={{ fontFamily: 'Poppins, sans-serif' }}>Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                  autoComplete="username"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" style={{ fontFamily: 'Poppins, sans-serif' }}>Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={loading}
                />
                <Label
                  htmlFor="remember-me"
                  className="text-sm font-normal cursor-pointer"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Remember me
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>

              <div 
                className="text-center text-sm text-muted-foreground"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Don't have an account?{' '}
                <Link href="/register" className="text-primary hover:underline">
                  Register
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

