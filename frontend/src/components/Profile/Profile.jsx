import React, { useContext, useState, useRef } from "react";
import "./Profile.css"
import { AuthContext } from "../ContextAPI/AuthContext";
import { GrEdit, GrCheckmark, GrClose } from "react-icons/gr";
import axios from "axios";
import { useToast } from "../ContextAPI/ToastContext";
import { ModalContext } from "../ContextAPI/ModalContext";
import { API_ENDPOINTS, AXIOS_CONFIG } from "../../api/ApiConfig";

export default function Profile() {
    const { user, setUser } = useContext(AuthContext);
    const [bio, setBio] = useState("");
    const [theme, setTheme] = useState("dark");
    const [profilePicPrivacy, setProfilePicPrivacy] = useState("everyone");
    const [lastSeenPrivacy, setLastSeenPrivacy] = useState("everyone");

    // States for inline editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(user.username);
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [newEmail, setNewEmail] = useState(user.email);
    const { openImageModal } = useContext(ModalContext);
    const { showToast } = useToast();
    const fileInputRef = useRef(null);

    // Trigger hidden file input
    const handleEditPicClick = () => {
        fileInputRef.current.click();
    };

    // Upload Profile Picture
    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.patch(API_ENDPOINTS.USERS.UPDATE_PIC, formData, {
                AXIOS_CONFIG,
                responseType: "arraybuffer"
            }
            );

            // 1. Convert the ArrayBuffer to Base64
            const base64Image = btoa(
                new Uint8Array(response.data).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ''
                )
            );

            const newImageUrl = `data:image/jpeg;base64,${base64Image}`;

            if (typeof setUser === 'function') {
                setUser(prevUser => ({
                    ...prevUser,
                    profilePicture: newImageUrl
                }));
                showToast.success("Profile picture updated!");
            } else {
                console.error("setUser is not defined in AuthContext. Check your Provider value.");
            }

        } catch (error) {
            showToast.error("Upload failed", error);
        }
    };

    return (
        <>
            <div className="profile-main">
                <div className="profile-header">
                    {/* Profile Picture Section */}
                    <div className="profile-img-div">
                        <img src={user.profilePicture || "/assets/default-logo.png"} alt="DP" onClick={(e) => {
                            e.stopPropagation(); openImageModal(user.profilePicture, user.username);
                        }} />
                        <button onClick={handleEditPicClick}><GrEdit /></button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Basic Info */}
                    <div className="profile-details">
                        <div className="username">
                            {isEditingName ? (
                                <div className="edit-input-group">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="inline-edit-input"
                                    />
                                    <button className="save-icon" onClick={() => setIsEditingName(false)}><GrCheckmark /></button>
                                    <button className="cancel-icon" onClick={() => setIsEditingName(false)}><GrClose /></button>
                                </div>
                            ) : (
                                <>
                                    <h1>{user.username}</h1>
                                    <button onClick={() => setIsEditingName(true)}><GrEdit /></button>
                                </>
                            )}
                        </div>
                        <div className="user-email">
                            {isEditingEmail ? (
                                <div className="edit-input-group">
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        className="inline-edit-input"
                                    />
                                    <button className="save-icon" onClick={() => setIsEditingEmail(false)}><GrCheckmark /></button>
                                    <button className="cancel-icon" onClick={() => setIsEditingEmail(false)}><GrClose /></button>
                                </div>
                            ) : (
                                <>
                                    <p className="profile-email">{user.email}</p>
                                    <button onClick={() => setIsEditingEmail(true)}><GrEdit /></button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="profile-body">
                    <div className="profile-section">
                        <label>About / Status</label>
                        <textarea
                            maxLength={150}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Busy, Available, Open to chat..."
                        />
                        <small>{bio.length}/150</small>
                    </div>

                    <div className="profile-section">
                        <label>Chat Theme</label>
                        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>

                    <div className="profile-section">
                        <label>Who can see my profile picture?</label>
                        <select value={profilePicPrivacy} onChange={(e) => setProfilePicPrivacy(e.target.value)}>
                            <option value="everyone">Everyone</option>
                            <option value="contacts">My Contacts</option>
                            <option value="nobody">Nobody</option>
                        </select>
                    </div>

                    <div className="profile-section">
                        <label>Who can see my last seen?</label>
                        <select value={lastSeenPrivacy} onChange={(e) => setLastSeenPrivacy(e.target.value)}>
                            <option value="everyone">Everyone</option>
                            <option value="contacts">My Contacts</option>
                            <option value="nobody">Nobody</option>
                        </select>
                    </div>

                    <div className="profile-section">
                        <button className="apply-changes" type="submit">Apply Changes</button>
                    </div>
                </div>
            </div>
        </>
    );
}