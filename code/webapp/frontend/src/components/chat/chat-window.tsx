"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Send, MessageCircle, Bot, User } from "lucide-react";
import { cn } from "@/utils";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm your circuit analysis assistant. I can help you understand your circuit, answer questions about components, analyze functionality, and more. What would you like to know?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // Simulate bot response (replace with actual API call)
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I understand you're asking about the circuit. Let me analyze the components and their connections to provide you with an accurate answer. Could you be more specific about what aspect you'd like me to explain?",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 w-80 h-96 bg-card border border-border rounded-lg shadow-lg flex flex-col z-50"
         style={{ backgroundColor: "hsl(var(--card))" }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Circuitron Assistant</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin bg-card/95"
           style={{ backgroundColor: "hsl(var(--card))" }}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2",
              message.sender === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.sender === "bot" && (
              <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Bot className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[70%] px-3 py-2 rounded-lg text-xs",
                message.sender === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {message.content}
            </div>
            {message.sender === "user" && (
              <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                <User className="h-3 w-3 text-foreground" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <Bot className="h-3 w-3 text-primary-foreground" />
            </div>
            <div className="bg-muted text-foreground px-3 py-2 rounded-lg text-xs">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-muted/30"
           style={{ backgroundColor: "hsl(var(--muted) / 0.3)" }}>
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your circuit..."
            className="flex-1 px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            size="sm"
            className="px-3 border border-input"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};