import { createSlice } from "@reduxjs/toolkit";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

const buildMessageId = (role: ChatMessage["role"]) =>
  `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const initialState: { messages: ChatMessage[] } = {
  messages: [],
};

const chatWithAISlice = createSlice({
  name: "chatWithAI",
  initialState,
  reducers: {
    addOutgoingMessage: (state, action: { payload: { content: string; timestamp?: string } }) => {
      state.messages.push({
        id: buildMessageId("user"),
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
          id: buildMessageId("assistant"),
          role: "assistant",
          content: html,
          timestamp: res_timestamp,
        });
      });
    },
    addConversationTurn: (
      state,
      action: {
        payload: {
          transcript?: string;
          support_reply?: string;
          res_timestamp?: string;
        };
      }
    ) => {
      const { transcript, support_reply, res_timestamp } = action.payload;
      const trimmedTranscript = transcript?.trim();
      const trimmedReply = support_reply?.trim();
      const lastMessage = state.messages[state.messages.length - 1];

      if (trimmedTranscript) {
        const shouldAppendTranscript =
          lastMessage?.role !== "user" || lastMessage.content.trim() !== trimmedTranscript;

        if (shouldAppendTranscript) {
          state.messages.push({
            id: buildMessageId("user"),
            role: "user",
            content: trimmedTranscript,
            timestamp: res_timestamp,
          });
        }
      }

      if (trimmedReply) {
        state.messages.push({
          id: buildMessageId("assistant"),
          role: "assistant",
          content: trimmedReply,
          timestamp: res_timestamp,
        });
      }
    },
    clearChat: (state) => {
      state.messages = [];
    },
  },
});

export const { addOutgoingMessage, addIncomingMessages, addConversationTurn, clearChat } = chatWithAISlice.actions;
export default chatWithAISlice.reducer;
