"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { ChatWindow } from "./chat-window";

export const FloatingChatButton: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={toggleChat}
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-40"
        size="sm"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Chat Window */}
      <ChatWindow 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </>
  );
};