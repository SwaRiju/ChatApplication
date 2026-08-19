import { createContext, useEffect, useState, useRef, useContext } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { AuthContext } from "./AuthContext";
import axios from "axios";
import { RequestCountContext } from "./RequestCountContext";
import { API_ENDPOINTS, AXIOS_CONFIG } from "../../api/ApiConfig";

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { isAuthenticated, loading, user } = useContext(AuthContext);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const subscriptionsRef = useRef(new Map());
  const [receiptUpdate, setReceiptUpdate] = useState(null);
  const { setRequestCount } = useContext(RequestCountContext);

  // 1. WebSocket Connection Logic
  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
        setConnected(false);
      }
      return;
    }

    if (clientRef.current) return;

    console.log("🔐 Connecting WebSocket...");

    const stompClient = new Client({
      webSocketFactory: () =>
        new SockJS(API_ENDPOINTS.WEBSOCKETS.CONNECT, null, AXIOS_CONFIG),
      reconnectDelay: 5000,
      debug: (msg) => {
        if (import.meta.env.DEV) console.log("[STOMP]", msg);
      },
    });

    stompClient.onConnect = () => {
      console.log("✅ WebSocket connected");
      setConnected(true);
    };

    stompClient.onDisconnect = () => {
      console.log("🔌 WebSocket disconnected");
      setConnected(false);
    };

    stompClient.onStompError = (frame) => {
      console.error("❌ STOMP error:", frame.headers["message"]);
      if (frame.headers["message"]?.includes("Reject") || frame.headers["message"]?.includes("Auth")) {
        stompClient.deactivate();
        setConnected(false);
      }
    };

    stompClient.activate();
    clientRef.current = stompClient;

    return () => {
      stompClient.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, loading]);

  // 2. Global Subscriptions (Delivery Acknowledgments & Receipts)
  useEffect(() => {
    if (!connected || !user?.id || !clientRef.current) return;

    console.log("🛠️ Initializing Global Subscriptions");

    /**
     * A. GLOBAL DELIVERY ACKNOWLEDGMENT
     * Listens to the chatlist topic. When any message arrives in ANY room,
     * this context triggers a 'DELIVERED' receipt.
     */
    const deliverySub = clientRef.current.subscribe(
      `/topic/chatlist/${user.id}`,
      (msg) => {
        const data = JSON.parse(msg.body);

        // Check if this notification is for a new message
        if (data.type === "LAST_MESSAGE") {
          const { messageId, senderId } = data;

          // If I am NOT the sender, send the DELIVERED ack
          // Note: Backend must include messageId and senderId in this payload
          if (senderId && String(senderId) !== String(user.id) && messageId) {
            clientRef.current.publish({
              destination: "/app/chat.ack",
              body: JSON.stringify({
                messageId: messageId,
                status: "DELIVERED",
              }),
            });
          }
        }
      }
    );

    /**
     * B. RECEIPT LISTENER
     * Listens for updates about messages I SENT (to show me if they were delivered/read)
     */
    const receiptSub = clientRef.current.subscribe(
      `/topic/receipt/${user.id}`,
      (msg) => {
        const data = JSON.parse(msg.body);
        setReceiptUpdate({
          messageId: data.messageId,
          roomId: data.roomId,
          status: data.status,
          allMessagesInRoom: data.allMessagesInRoom,
          ts: Date.now(),
        });
      }
    );

    subscriptionsRef.current.set("global-delivery", deliverySub);
    subscriptionsRef.current.set("global-receipt", receiptSub);

    return () => {
      deliverySub.unsubscribe();
      receiptSub.unsubscribe();
      subscriptionsRef.current.delete("global-delivery");
      subscriptionsRef.current.delete("global-receipt");
    };
  }, [connected, user?.id]);

  // 3. Helper Functions
  const subscribe = (destination, callback) => {
    if (!clientRef.current || !connected) return null;

    if (subscriptionsRef.current.has(destination)) {
      console.warn(`Already subscribed to ${destination}`);
      return null;
    }

    const sub = clientRef.current.subscribe(destination, callback);
    subscriptionsRef.current.set(destination, sub);

    return () => {
      sub.unsubscribe();
      subscriptionsRef.current.delete(destination);
    };
  };

  const unsubscribeAll = () => {
    subscriptionsRef.current.forEach((sub) => {
      try { sub.unsubscribe(); } catch { }
    });
    subscriptionsRef.current.clear();
  };

  // 4. Initial Unread Request Count
  useEffect(() => {
    if (!isAuthenticated) return;
    axios
      .get(API_ENDPOINTS.CONNECTION.UNREAD_COUNT, AXIOS_CONFIG)
      .then((res) => setRequestCount(res.data))
      .catch((err) => console.error("Failed to load unread count", err));
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider
      value={{
        client: clientRef.current,
        connected,
        subscribe,
        unsubscribeAll,
        receiptUpdate
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}