import React, { useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import "./ChatList.css";
import { ChatContext } from "../ContextAPI/ChatContext";
import { ModalContext } from "../ContextAPI/ModalContext";
import { AuthContext } from "../ContextAPI/AuthContext";
import { usePageManager } from "../ContextAPI/PageManagerContext";
import { SocketContext } from "../ContextAPI/SocketContext";
import { useToast } from "../ContextAPI/ToastContext";
import { RequestCountContext } from "../ContextAPI/RequestCountContext";
import {API_ENDPOINTS, AXIOS_CONFIG} from "../../api/ApiConfig"


export default function ChatList() {
  const { contacts, setContacts, selectedContact, setSelectedContact, searchResults, searchQuery } =
    useContext(ChatContext);

  const { client, connected } = useContext(SocketContext);
  const { openInviteModal } = useContext(ModalContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sentRequests, setSentRequests] = useState(new Set());
  const { user } = useContext(AuthContext);
  const { goToPage } = usePageManager();
  const { openImageModal } = useContext(ModalContext);
  const { setRequestCount } = useContext(RequestCountContext);
  const { showToast } = useToast();
  const userLoggedInId = user?.id;


  const sortChatsByDate = (list) => {
    return [...list].sort((a, b) => {
      // We use rawMessageTime (the Instant) for logic
      const t1 = a.rawMessageTime ? new Date(a.rawMessageTime).getTime() : 0;
      const t2 = b.rawMessageTime ? new Date(b.rawMessageTime).getTime() : 0;
      return t2 - t1;
    });
  };

  // ░░ FETCH CONTACTS ░░
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          API_ENDPOINTS.CONTACTS.GET_ALL,
          AXIOS_CONFIG
        );

        const processed = response.data.map(c => ({
          ...c,
          unreadCount: c.unreadCount ?? 0
        }));

        setContacts(sortChatsByDate(processed));

      } catch (err) {
        setError("Unable to load contacts");
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  const selectedRoomRef = useRef(null);
  useEffect(() => {
    selectedRoomRef.current = selectedContact?.roomId ?? null;
  }, [selectedContact]);


  // ░░ WEBSOCKET LISTENER ░░
  const chatlistSubRef = useRef(null);
  const unreadSubRef = useRef(null);

  useEffect(() => {
    if (!client || !connected || !client.connected || !userLoggedInId) return;

    // cleanup old subscriptions
    chatlistSubRef.current?.unsubscribe();
    unreadSubRef.current?.unsubscribe();

    // ===============================
    // Chatlist subscription
    // ===============================
    chatlistSubRef.current = client.subscribe(
      `/topic/chatlist/${userLoggedInId}`,
      (msg) => {
        const data = JSON.parse(msg.body);

        if (data.type === "STATUS_CHANGE") {
          const { userId, status } = data;
          setContacts(prev =>
            prev.map(c => c.userId === userId ? { ...c, status } : c)
          );
          setSelectedContact(prev =>
            prev?.userId === userId ? { ...prev, status } : prev
          );
        }

        if (data.type === "LAST_MESSAGE") {
          const { roomId, msg: lastMessage, time, formattedTime } = data;
          setContacts(prev => {
            const updated = prev.map(c =>
              c.roomId === roomId
                ? { ...c, lastMessage, lastMessageTime: formattedTime, rawMessageTime: time }
                : c
            );
            return sortChatsByDate(updated);
          });
          setSelectedContact(prev =>
            prev?.roomId === roomId
              ? { ...prev, lastMessage, lastMessageTime: formattedTime }
              : prev
          );
        }

        if (data.type === "READ_RESET") {
          const { roomId } = data;
          setContacts(prev =>
            prev.map(c => c.roomId === roomId ? { ...c, unreadCount: 0 } : c)
          );
          // Sync active room state
          setSelectedContact(prev =>
            prev?.roomId === roomId ? { ...prev, unreadCount: 0 } : prev
          );
        }

        if (data.type === "CONTACT_ADDED") {
          const newContact = data.contact;

          setContacts(prev => {
            if (prev.some(c => c.userId === newContact.userId)) return prev;

            return [newContact, ...prev];
          });
        }

        if (data.type === "REQUEST_REJECTED") {
          setSentRequests(prev => {
            const copy = new Set(prev);
            copy.delete(data.requestId);
            return copy;
          });
        }

        if (data.type === "NEW_CONNECTION_REQUEST") {
          const fromUser = data.fromUser;

          showToast.info(
            `${fromUser.username} sent you a connection request`
          );

          setRequestCount(prev => prev + 1);
        }

        if (data.type === "REQUEST_COUNT_DECREMENT") {
          setRequestCount(prev => Math.max(prev - data.by, 0));
        }

        if (data.type === "PROFILE_UPDATE") {
          const { userId, profilePicture } = data;

          // Update contacts list
          setContacts(prev =>
            prev.map(c =>
              c.userId === userId
                ? { ...c, profilePicture }
                : c
            )
          );

          // Update selected contact if open
          setSelectedContact(prev =>
            prev?.userId === userId
              ? { ...prev, profilePicture }
              : prev
          );
        }
      }
    ); // <--- Closing the first subscription callback properly

    // ===============================
    // Unread count subscription
    // ===============================
    unreadSubRef.current = client.subscribe(
      "/user/queue/unread",
      (msg) => {
        const data = JSON.parse(msg.body);
        const { roomId, unreadCount, count } = data;
        const finalCount = unreadCount !== undefined ? unreadCount : count;

        setContacts(prev =>
          prev.map(c => {
            if (c.roomId === roomId) {
              return { ...c, unreadCount: finalCount };
            }
            return c;
          })
        );
      }
    );


    return () => {
      chatlistSubRef.current?.unsubscribe();
      unreadSubRef.current?.unsubscribe();
    };
  }, [client, connected, userLoggedInId]);


  const sendRequest = async (targetId) => {
    try {
      await axios.post(
        API_ENDPOINTS.CONNECTION.SEND_REQUEST(targetId),
        {},
        AXIOS_CONFIG
      );
      setSentRequests((prev) => new Set(prev).add(targetId));
      showToast.success("Connection request sent!");
    } catch (err) {
      showToast.error(err.response.data);
      console.error(err);
    }
  };




  let displayList = [];

  if (!searchQuery) {
    // Case 1: No Search -> Show all contacts normally
    displayList = contacts;
  } else {
    // Case 2: User is Searching

    // A. Filter Local Contacts (Instant)
    const localMatches = contacts.filter((c) => {
      const name = c.roomName || c.username || "";
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // B. Filter Backend Results (Remove duplicates if they are already in contacts)
    // We use email as a unique key to check if they are already in localMatches
    const localEmails = new Set(localMatches.map(c => c.email));

    const uniqueBackendResults = searchResults.filter(
      (result) => !localEmails.has(result.email)
    );

    // C. Combine them
    // Local matches first (friends), then global results (strangers)
    displayList = [...localMatches, ...uniqueBackendResults];
  }

  if (!displayList || displayList.length === 0) {
    return (
      <div className="empty-chat-list">
        <h3>
          {searchQuery ? "No users found!" : "Start connecting with friends!"}
        </h3>
        <p>
          {searchQuery
            ? "Try different username or email and hit enter to search."
            : "Search by email to find people or invite new users."}
        </p>
      </div>
    );
  }
  if (loading) return <div className="chat-list-loading">Loading...</div>;
  if (error) return <div className="chat-list-error">{error}</div>;

  return (
    <div className="chat-list">
      {displayList.map((user, i) => {
        const isNotFound = user.exists === false;
        const username = user.username;
        const email = user.email;
        const profilePicture = user.profilePicture || "/assets/default-logo.png";
        const isContact = contacts.some((c) => c.email === user.email);
        const lastMessage = isContact ? (user.lastMessage || "Start your conversation!") : "Not in Contacts";
        const lastMessageTime = isContact ? (user.lastMessageTime || "") : "";
        const status = user.status ?? "INACTIVE";
        const roomId = user.roomId;

        // const isContact =
        //   !isNotFound &&
        //   contacts.some((c) => c.email === user.email);
        const isSelected = selectedContact?.roomId === user.roomId;
        return (
          <div
            key={user.roomId || user.email}
            className={`chat-item ${isSelected ? "active" : ""}`}
            onClick={() => {
              if (!roomId || isNotFound || !isContact) return;

              if (!isNotFound && isContact) {

                const fullContact = contacts.find(c => c.email === user.email);

                if (!fullContact) return;

                setSelectedContact({
                  userId: user.id,
                  username,
                  profilePicture,
                  email,
                  roomId,
                  roomName: user.roomName ?? user.username,
                  status,
                  lastMessage,
                  lastMessageTime
                });
                goToPage("home");
              }
            }}
          >
            <div className="avatar" onClick={(e) => {
              e.stopPropagation(); openImageModal(profilePicture, username);
            }}>
              <img src={profilePicture} alt="profile-dp" />
            </div>

            <div className="chat-info">
              <div className="details">
                {isNotFound ? (
                  <>
                    <h4>User not found</h4>
                    <p>{user.search}</p>
                  </>
                ) : (
                  <>
                    <div className="details-name">
                      <h4>{user.roomName ?? username}</h4>
                      <p className="last-message">{lastMessage}</p>
                    </div>
                    <div className="chat-time">{lastMessageTime}
                      {user.unreadCount > 0 && (
                        <span className="unread-badge">
                          {user.unreadCount}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
              {searchQuery &&
                (isNotFound ? (
                  <button
                    className="invite-btn"
                    onClick={(e) => { e.stopPropagation(); openInviteModal(user.search) }}
                  >
                    Invite
                  </button>
                ) : searchQuery && !isContact && !isNotFound && (
                  <button
                    className={
                      sentRequests.has(user.id)
                        ? "connect-btn-sent"
                        : "connect-btn"
                    }
                    disabled={sentRequests.has(user.id)}
                    onClick={(e) => { e.stopPropagation(); sendRequest(user.id) }}
                  >
                    {sentRequests.has(user.id) ? "Pending" : "Connect"}
                  </button>
                ))}
            </div>
          </div>
        );
      })}
    </div >
  );
}
