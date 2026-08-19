import React, { useContext, useState, useEffect, useRef } from "react";
import "./Sidebar.css";
import { FaGear } from "react-icons/fa6";
import { FaSearch } from "react-icons/fa";
import axios from "axios";
import { ChatContext } from "../ContextAPI/ChatContext";
import { useNavigate } from "react-router-dom";
import { usePageManager } from "../ContextAPI/PageManagerContext";
import { useToast } from "../ContextAPI/ToastContext";
import { RequestCountContext } from "../ContextAPI/RequestCountContext";
import { API_ENDPOINTS, AXIOS_CONFIG } from "../../api/ApiConfig";


export default function Sidebar() {
  const { searchQuery, setSearchQuery, setSearchResults } =
    useContext(ChatContext);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const { goToPage } = usePageManager();
  const { goBack } = usePageManager();
  const { showToast } = useToast();
  const { requestCount } = useContext(RequestCountContext);
  const [isLoggedOut, setIsLoggedOut] = useState(false);


  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await axios.get(
        API_ENDPOINTS.USERS.SEARCH(searchQuery),
        AXIOS_CONFIG
      );
      setSearchResults(response.data);
    } catch (err) {
      console.error("Search failed", err);
      setSearchResults([]);
    }
  };

  const onInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    // If user clears the input, clear the backend results immediately
    if (val.trim() === "") {
      setSearchResults([]);
    }
  };

  const handleLogOut = async () => {

    if(isLoggedOut) return;
    setIsLoggedOut(true);

    try {
      const response = await axios.post(
        API_ENDPOINTS.AUTH.LOGOUT,
        {},
        {
          AXIOS_CONFIG,
        }
      );
      if (response.status === 200) {
        showToast.success("Logged out successfully!");
        setSearchResults([]);
        setSearchQuery("");
        goBack();
        localStorage.removeItem("auth");
        localStorage.removeItem("user");
        document.cookie.split(";").forEach((cookie) => {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name === "userData") {
            document.cookie = `${name}=; Max-Age=0; path=/`;
            document.cookie = `${name}=; Max-Age=0; path=/main`;
            document.cookie = `${name}=; Max-Age=0; path=/chat`;
          }
        });
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      }
    } catch (err) {
      showToast.error("Logout Failed");
      console.error("Logout Failed", err);
      setSearchResults([]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="sidebar-header">
      <div className="settings" ref={menuRef}>
        <h2 className="logo">ChatAPP</h2>
        {/* 🌟 SETTINGS ICON + DROPDOWN */}
        <span className="settings-icon" onClick={() => !isLoggedOut && setShowMenu(!showMenu)}>
          <FaGear />
        </span>

        {showMenu && (
          <div className="settings-menu">
            <button className="menu-item" onClick={() => goToPage("profile")}>Profile</button>
            <button className="menu-item" onClick={() => goToPage("request")}>Connection Requests {requestCount > 0 && (
              <span className="conn-badge"> {requestCount} </span>
            )}</button>
            <button className="menu-item" onClick={handleLogOut} disabled={isLoggedOut}>
              {isLoggedOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        )}
      </div>
      <div className="search-box">
        <span className="search-icon">
          <FaSearch />
        </span>
        <input
          type="text"
          placeholder="Search people or start a new chat..."
          value={searchQuery}
          onChange={onInputChange}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>
    </div>
  );
}
