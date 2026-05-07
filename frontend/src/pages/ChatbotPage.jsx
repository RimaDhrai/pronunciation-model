import AppLayout from '../components/layout/AppLayout';
import ChatbotAvatar from '../components/chatbot/ChatbotAvatar';

export default function ChatbotPage() {
  const isMobile = window.innerWidth < 640;
  return (
    <AppLayout title="Coach Vocal">
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'stretch',
        padding: isMobile ? '0' : '20px 24px',
        height: isMobile ? 'calc(100dvh - 56px)' : 'calc(100vh - 64px)',
        boxSizing: 'border-box',
      }}>
        <div style={{ width: '100%', maxWidth: 1100, minWidth: 0 }}>
          <ChatbotAvatar />
        </div>
      </div>
    </AppLayout>
  );
}
