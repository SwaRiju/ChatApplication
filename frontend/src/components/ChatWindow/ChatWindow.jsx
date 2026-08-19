import { useState, useRef, useEffect, useContext } from "react";
import "./ChatWindow.css";
import axios from "axios";
import { IoCall } from "react-icons/io5";
import { FaVideo } from "react-icons/fa";
import { BsThreeDotsVertical } from "react-icons/bs";
import { IoMdAdd } from "react-icons/io";
import { MdKeyboardVoice } from "react-icons/md";
import { GoDotFill } from "react-icons/go";
import { ChatContext } from "../ContextAPI/ChatContext";
import { MdEmojiEmotions } from "react-icons/md";
import 'emoji-picker-element';
import { AuthContext } from "../ContextAPI/AuthContext";
import { SocketContext } from "../ContextAPI/SocketContext";
import { useToast } from "../ContextAPI/ToastContext";
import { ModalContext } from "../ContextAPI/ModalContext";
import { IoIosArrowDropdownCircle } from "react-icons/io";
import { IoMdClose } from "react-icons/io";
import { API_ENDPOINTS, AXIOS_CONFIG } from "../../api/ApiConfig";

export default function ChatWindow() {
  const { contacts, setContacts, selectedContact, setSelectedContact } = useContext(ChatContext);
  const [messages, setMessages] = useState([]);
  const { user } = useContext(AuthContext);
  const currentUserId = user?.id;
  const [newMessage, setNewMessage] = useState("");
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const emojiPickerRef = useRef(null);
  const { client, connected, receiptUpdate } = useContext(SocketContext);
  const messagesContainerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const initialLoadRef = useRef(true);
  const pendingReceiptsRef = useRef(new Map());
  const { showToast } = useToast();
  const { openImageModal } = useContext(ModalContext);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollHideTimerRef = useRef(null);
  const [dropdownMenu, setDropdownMenu] = useState(false);
  const [delteChatPopUp, setDeleteChatpopUp] = useState(false);



  const isOnline = selectedContact?.status === "ACTIVE";

  const safeImage = (url) => url || "/assets/default-logo.png";

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerVisible &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target) &&
        !event.target.closest('.emoji-button')
      ) {
        setEmojiPickerVisible(false);
      }

      if (dropdownMenu && !event.target.closest('.chat-actions')) {
        setDropdownMenu(false);
      }

      if(delteChatPopUp && !event.target.closest('.inner-container')){
        setDeleteChatpopUp(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [emojiPickerVisible, dropdownMenu]);


  // Update header if status changes
  useEffect(() => {
    if (!selectedContact) return;

    const updated = contacts.find(c => c.userId === selectedContact.userId);
    if (!updated) return;

    if (
      updated.status !== selectedContact.status ||
      updated.profilePicture !== selectedContact.profilePicture
    ) {
      setSelectedContact(prev => ({
        ...prev,
        status: updated.status,
        profilePicture: safeImage(updated.profilePicture)
      }));
    }
  }, [contacts]);

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;

    el.scrollTop = el.scrollHeight;

    setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 50);
  };


  const markRoomAsRead = async () => {
    if (!selectedContact?.roomId) return;
    try {
      await axios.post(
        API_ENDPOINTS.MESSAGES.MARK_READ(selectedContact.roomId),
        {},
        AXIOS_CONFIG
      );
    } catch (err) {
      console.error("Failed to mark room read", err);
    }
  };

  const lastReadMsgRef = useRef(null);

  useEffect(() => {
    if (!selectedContact || !client || !connected) return;

    let isMounted = true;
    initialLoadRef.current = true;
    lastReadMsgRef.current = null;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          API_ENDPOINTS.MESSAGES.GET_HISTORY(selectedContact.roomId),
          AXIOS_CONFIG
        );

        if (!isMounted) return;
        const processed = res.data.map(m => {
          const pending = pendingReceiptsRef.current.get(m.id);
          if (pending) pendingReceiptsRef.current.delete(m.id);

          let status = "SENT";
          if (m.readByUserIds && m.readByUserIds?.length > 0) {
            status = "READ";
          } else if (m.deliveredToUserIds && m.deliveredToUserIds?.length > 0) {
            status = "DELIVERED";
          }

          return {
            ...m,
            receiptStatus: Number(m.senderId) === Number(currentUserId) ? status : "READ"
          };
        });

        setMessages(processed);
        markRoomAsRead();

        pendingReceiptsRef.current.forEach((status, messageId) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === messageId ? { ...m, receiptStatus: status } : m
            )
          );
        });


        requestAnimationFrame(() => {
          scrollToBottom();
          initialLoadRef.current = false;
        });

      } catch {
        showToast.error("Failed to load messages");
      }
    };

    fetchMessages();

    const sub = client.subscribe(
      `/topic/room/${selectedContact.roomId}`,
      (msg) => {
        const message = JSON.parse(msg.body);
        const sentByMe = Number(message.senderId) === Number(currentUserId);

        if (!sentByMe) {
          if (document.hasFocus()) {
            client.publish({
              destination: "/app/chat.ack",
              body: JSON.stringify({
                messageId: message.id,
                status: "READ",
              }),
            });
          }
        }

        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, {
            ...message,
            receiptStatus: sentByMe ? "SENT" : "READ"
          }];
        });

        if (isAtBottomRef.current) {
          requestAnimationFrame(scrollToBottom);
        }
      }
    );

    const subPrivate = client.subscribe(`/user/queue/chat-events`, (msg) => {
      const event = JSON.parse(msg.body);

      if (event.type === "CHAT_CLEARED" && Number(event.roomId) === Number(selectedContact.roomId)) {
        setMessages([]);
      }
    });

    return () => {
      isMounted = false;
      sub.unsubscribe();
      subPrivate.unsubscribe();
    };
  }, [selectedContact?.roomId, client, connected, currentUserId]);


  useEffect(() => {
    if (!selectedContact) return;

    const handleFocus = () => {
      markRoomAsRead();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [selectedContact?.roomId]);


  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };


  useEffect(() => {
    if (!receiptUpdate || !selectedContact || !currentUserId) return;

    const isCorrectRoom = Number(receiptUpdate.roomId) === Number(selectedContact.roomId);
    if (!isCorrectRoom) return;

    const { messageId, status, allMessagesInRoom } = receiptUpdate;
    const RECEIPT_PRIORITY = { SENT: 1, DELIVERED: 2, READ: 3 };

    setMessages((prevMessages) => {
      if (allMessagesInRoom) {
        return prevMessages.map((m) => {
          const isSentByMe = Number(m.senderId) === Number(currentUserId);
          // Only update my own messages to READ
          if (isSentByMe && m.receiptStatus !== "READ") {
            return { ...m, receiptStatus: "READ" };
          }
          return m;
        });
      }

      return prevMessages.map((m) => {
        if (m.id === messageId) {
          const currentStatus = m.receiptStatus || "SENT";
          if (RECEIPT_PRIORITY[status] > RECEIPT_PRIORITY[currentStatus]) {
            return { ...m, receiptStatus: status };
          }
        }
        return m;
      });
    });
  }, [receiptUpdate, selectedContact?.roomId, currentUserId]);


  const sendingRef = useRef(false);
  const sendMessage = async (customText = null) => {
    if (sendingRef.current) return;

    const contentToSend = customText || newMessage.trim();

    if (!contentToSend || !selectedContact) return;

    sendingRef.current = true;

    try {
      const payload = {
        roomId: selectedContact.roomId,
        content: contentToSend,
      };

      await axios.post(
        API_ENDPOINTS.MESSAGES.SEND,
        payload,
        { withCredentials: true }
      );

      setNewMessage(""); // Clear input
    } catch (err) {
      console.error("Send message failed:", err);
      showToast.error("Failed to send message");
    } finally {
      sendingRef.current = false;
    }
  };


  const addEmoji = (emoji) => {
    setNewMessage((prev) => prev + emoji.unicode);
  };

  const scrollToBottomSmooth = () => {
    const el = messagesContainerRef.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth"
    });
  };

  useEffect(() => {
    return () => {
      if (scrollHideTimerRef.current) {
        clearTimeout(scrollHideTimerRef.current);
      }
    };
  }, []);


  const pauseScrollHide = () => {
    if (scrollHideTimerRef.current) {
      clearTimeout(scrollHideTimerRef.current);
    }
  };

  const resumeScrollHide = () => {
    scrollHideTimerRef.current = setTimeout(() => {
      setShowScrollDown(false);
    }, 2000);
  };

  const clearAllChat = async ()=> {
    try {
      await axios.delete(API_ENDPOINTS.MESSAGES.CLEAR_CHAT(selectedContact.roomId), AXIOS_CONFIG);
      showToast.success("Messages Deleted Successfully!");
      setDeleteChatpopUp(false);
    } catch (error) {
      console.log(error);
      showToast.error("Error deleting messages")
    };
  };

  if (!selectedContact) {
    return (
      <div className="chat-window-placeholder">
        <img src="/assets/77881.jpg" alt="" />
        <p>Select a contact to start chat</p>
      </div>
    );
  }


  return (
    <div className="chat-container">

      <div className="chat-header">
        <div className="sender-info">
          <div className="avatar" onClick={(e) => {
            e.stopPropagation(); openImageModal(selectedContact.profilePicture, selectedContact.username);
          }}>
            <img src={selectedContact.profilePicture || "/assets/default-logo.png"} alt=""></img>
          </div>

          <h3>
            {selectedContact.username}
            <span>
              (<GoDotFill className={`online ${isOnline ? "" : "offline"}`} />
              {isOnline ? "Online" : "Offline"} )
            </span>
          </h3>
        </div>
        <div className="chat-actions">
          <span><FaVideo /></span>
          <span><IoCall /></span>
          <span onClick={() => setDropdownMenu(prev => !prev)}><BsThreeDotsVertical /></span>
          {dropdownMenu && (
            <div className="chatwindow-dropdown-main">
              <button>New Group</button>
              <button>Block</button>
              <button onClick={() => {setDeleteChatpopUp(prev => !prev), setDropdownMenu(false)}}>Delete Chat</button>
            </div>
          )}
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef}
        onScroll={() => {
          const el = messagesContainerRef.current;
          if (!el) return;

          const threshold = 120;
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

          isAtBottomRef.current = atBottom;
          if (!atBottom) {
            // 👇 Show button immediately
            setShowScrollDown(true);

            // 👇 Reset existing timer
            if (scrollHideTimerRef.current) {
              clearTimeout(scrollHideTimerRef.current);
            }

            // 👇 Auto-hide after 2s of no scrolling
            scrollHideTimerRef.current = setTimeout(() => {
              setShowScrollDown(false);
            }, 2000);
          } else {
            // If user scrolls back to bottom, hide instantly
            setShowScrollDown(false);
          }
        }}>

        <div className="new-chat">
          <span><img src={selectedContact.profilePicture || "/assets/default-logo.png"} alt="" /></span>
          <h2>{selectedContact.username}</h2>
          {messages.length === 0 && (
            <>
              <p>Start Chatting with {selectedContact.username} by sending Hi!</p>
              <button onClick={() => sendMessage("Hello!")}>Send Hello</button>
            </>
          )}
        </div>

        {messages.map(msg => {
          const isSentByMe = Number(msg.senderId) === Number(currentUserId);
          const key = msg.id ?? `${msg.senderId} - ${msg.sentAt}`;
          return (
            <div key={key} className={isSentByMe ? "sent-wrapper" : "received-wrapper"}>

              <span className={isSentByMe ? "senttime" : "receivedtime"}>
                {new Date(msg.sentAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>

              <div className={isSentByMe ? "sent" : "received"}>
                <p>{msg.content}</p>
                {isSentByMe && (
                  <span className={`receipt tick-${msg.receiptStatus?.toLowerCase()}`}>
                    {msg.receiptStatus === "READ"
                      ? "✔✔"
                      : msg.receiptStatus === "DELIVERED"
                        ? "✔✔"
                        : "✔"}
                  </span>
                )}
              </div>

            </div>
          );
        })}

      </div>

      <div className="chat-input">
        <span className="add-files"><IoMdAdd /></span>

        <div className="chat-input-emoji-input">
          <span className="emoji-button"
            onClick={(e) => { e.stopPropagation(); setEmojiPickerVisible((prev) => !prev) }}
          >
            <MdEmojiEmotions />
          </span>

          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
          />

          {emojiPickerVisible && (
            <div
              className="emoji-picker-wrapper"
              ref={emojiPickerRef}
              onClick={(e) => e.stopPropagation()}>
              <emoji-picker
                onemoji-click={(e) => addEmoji(e.detail)}
              ></emoji-picker>
            </div>
          )}

          <span className="mic"><MdKeyboardVoice /></span>
        </div>

        <button className="send" onClick={sendMessage}>➤</button>
      </div>
      {showScrollDown && (
        <div
          className="scroll-to-bottom-smooth"
          onClick={scrollToBottomSmooth}
          onMouseEnter={pauseScrollHide}
          onMouseLeave={resumeScrollHide}
        >
          <IoIosArrowDropdownCircle />
        </div>
      )}

      {delteChatPopUp &&(
        <div className="delteChat-main">
          <div className="inner-container">
            <div className="delete-popup-content">
            <span onClick={()=> setDeleteChatpopUp(false)}><IoMdClose /></span>
            <h3>Are you sure you want to Delete all messages?</h3>
            <p>This will delete entire chat history for you.</p>
            </div>
            <div className="delete-action-buttons">
              <button className="delete-yes" onClick={clearAllChat}>Yes, I'm Sure</button>
              <button className="delete-no" onClick={()=> setDeleteChatpopUp(false)}>No, Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
