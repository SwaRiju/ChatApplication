import React, { useState } from "react";
import "./InviteModal.css";
import axios from "axios";
import { toast } from "react-toastify";
import { IoClose } from "react-icons/io5";
import { API_ENDPOINTS, AXIOS_CONFIG } from "../../../api/ApiConfig";

export default function InviteModal({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleBackgroundClick = (e) => {
    if (e.target.className === "invite-modal-overlay") {
      onClose();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendInvite();
    }
  };

  // ✅ simple & reliable email regex
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const sendInvite = async () => {
    if (isSending) return;

    if(!name.trim() && !email.trim()){
      toast.error("Name and Email should not be empty");
      return;
    }

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setIsSending(true);

      await axios.post(
        API_ENDPOINTS.INVITATIONS.SEND,
        { name: name.trim(), email: email.trim() },
        AXIOS_CONFIG
      );

      toast.success("Invitation sent!", { autoClose: 1500 });

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data || "Failed to send invite");
      setIsSending(false);
    }
  };

  return (
    <div className="invite-modal-overlay" onClick={handleBackgroundClick}>
      <div className="invite-modal-container">
        <button className="close-btn" onClick={onClose} disabled={isSending}>
          <IoClose />
        </button>

        <h2>Send Invite</h2>

        <div className="modal-field">
          <label>Enter Name</label>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            disabled={isSending}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyPress}
          />
        </div>

        <div className="modal-field">
          <label>Enter Email</label>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            disabled={isSending}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyPress}
          />
        </div>

        <button
          className="send-btn"
          onClick={sendInvite}
          disabled={isSending}
        >
          {isSending ? "Sending..." : "Send Invite"}
        </button>
      </div>
    </div>
  );
}
