import { createSlice } from "@reduxjs/toolkit";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

const initialState: { messages: ChatMessage[] } = {
  messages: [],
};

const chatWithAISlice = createSlice({
  name: "chatWithAI",
  initialState,
  reducers: {
    addOutgoingMessage: (state, action: { payload: { content: string; timestamp?: string } }) => {
      state.messages.push({
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: "user",
        content: action.payload.content,
        timestamp: action.payload.timestamp,
      });
    },
    addIncomingMessages: (
      state,
      action: { payload: { content: string[]; res_timestamp?: string } }
    ) => {
      const { content = [], res_timestamp } = action.payload;
      content.forEach((html) => {
        state.messages.push({
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: "assistant",
          content: html,
          timestamp: res_timestamp,
        });
      });
    },
    clearChat: (state) => {
      state.messages = [];
    },
  },
});

export const { addOutgoingMessage, addIncomingMessages, clearChat } = chatWithAISlice.actions;
export default chatWithAISlice.reducer;
