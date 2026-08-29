import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BottleProvider, useBottle } from './context/BottleContext';
import { ThemeProvider } from './context/ThemeContext';
import { SplashScreen } from './features/splash/SplashScreen';
import { AuthScreen } from './features/auth/AuthScreen';
import { BottlePairingScreen } from './features/pairing/BottlePairingScreen';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import { CommunityMapScreen } from './features/community/CommunityMapScreen';
import { AICoachScreen } from './features/coach/AICoachScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { AppLayout } from './components/layout/AppLayout';
import { NavTab } from './types';
import { notificationService } from './services/notifications/notificationService';

const MainAppContent: React.FC = () => {
  const { user, loading, isPairingModalOpen, setIsPairingModalOpen } = useAuth();
  const [splashFinished, setSplashFinished] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Attach foreground FCM listener when user is active
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    notificationService.listenForegroundMessages().then((unsub) => {
      if (unsub) {
        unsubscribe = unsub;
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Step 1: Splash Screen
  if (!splashFinished) {
    return <SplashScreen onFinish={() => setSplashFinished(true)} />;
  }

  // Step 2: Auth Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-neutral-400 tracking-wider">
          SYNCHRONIZING AQUASENSE CLOUD
        </p>
      </div>
    );
  }

  // Step 3: Unauthenticated -> Show Login/Sign Up
  if (!user) {
    return <AuthScreen />;
  }

  // Step 4: First-time Onboarding: User has no paired bottle -> Show Bottle Pairing
  // (Pairing is strictly a one-time onboarding step; once paired, user goes straight to dashboard)
  if (!user.bottleId || isPairingModalOpen) {
    return (
      <BottlePairingScreen
        isChangeBottle={isPairingModalOpen}
        onPaired={() => {
          setIsPairingModalOpen(false);
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  // Step 5: Returning User with Paired Bottle -> Main Application Layout
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onNavigateToTab={(tab) => setCurrentTab(tab)}
            onPublishToCommunity={(report) => {
              if (report?.id) {
                setSelectedReportId(report.id);
              }
              setCurrentTab('community');
            }}
          />
        );
      case 'community':
        return <CommunityMapScreen initialSelectedReportId={selectedReportId} />;
      case 'coach':
        return <AICoachScreen />;
      case 'profile':
        return (
          <ProfileScreen
            onChangeBottle={() => setIsPairingModalOpen(true)}
          />
        );
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <AppLayout currentTab={currentTab} onSelectTab={setCurrentTab}>
      {renderTabContent()}
    </AppLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BottleProvider>
        <ThemeProvider>
          <MainAppContent />
        </ThemeProvider>
      </BottleProvider>
    </AuthProvider>
  );
}
