
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { getQualityAdvice } from '../services/geminiService';
import { ChatMessage } from '../types';

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'مرحباً بك! أنا مساعدك الذكي في أنظمة الجودة. كيف يمكنني مساعدتك اليوم؟ يمكنني المساعدة في تفسير بنود الأيزو، اقتراح إجراءات تصحيحية، أو شرح مفاهيم إدارة الجودة.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const aiResponse = await getQualityAdvice(userMsg);
    setMessages(prev => [...prev, { role: 'model', text: aiResponse }]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          مساعد الجودة الذكي
          <Sparkles className="text-amber-500" size={24} />
        </h2>
        <p className="text-gray-500">مدعوم بتقنية Gemini لتحليل واستشارات الجودة الاحترافية</p>
      </div>

      {!hasKey && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">يرجى اختيار مفتاح API لتفعيل المساعد الذكي</span>
          </div>
          <button 
            onClick={handleSelectKey}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            إعداد المفتاح
          </button>
        </div>
      )}

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50"
        >
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center shrink-0
                ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-100 border border-gray-200'}
              `}>
                {msg.role === 'user' ? <User size={20} className="text-white" /> : <Bot size={20} className="text-blue-600" />}
              </div>
              <div className={`
                max-w-[80%] p-4 rounded-2xl shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}
              `}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Bot size={20} className="text-blue-600" />
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                <Loader2 size={18} className="animate-spin text-blue-500" />
                <span className="text-gray-500 text-sm">جاري التفكير...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="relative flex items-center gap-2">
            <textarea
              rows={1}
              placeholder="اكتب سؤالك هنا (مثلاً: ما هي متطلبات البند 7.1 في ISO 9001؟)"
              className="w-full pr-4 pl-12 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`
                p-2.5 rounded-lg transition-all absolute left-2
                ${input.trim() && !isLoading ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-2">
            يمكن للذكاء الاصطناعي أن يخطئ أحياناً. يرجى التحقق من المراجع الرسمية.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
