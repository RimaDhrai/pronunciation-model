import AppLayout from '../components/layout/AppLayout';
import ChatbotAvatar from '../components/chatbot/ChatbotAvatar';

export default function ChatbotPage() {
  return (
    <AppLayout title="Coach Vocal">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', padding: '20px 24px', height: 'calc(100vh - 64px)', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 1100, minWidth: 0 }}>
          <ChatbotAvatar />
        </div>
      </div>
    </AppLayout>
  );
}
