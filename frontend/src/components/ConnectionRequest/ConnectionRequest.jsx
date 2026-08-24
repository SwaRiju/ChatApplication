import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import "./ConnectionRequest.css";
import { AuthContext } from "../ContextAPI/AuthContext";
import { RequestCountContext } from "../ContextAPI/RequestCountContext";
import { API_ENDPOINTS, AXIOS_CONFIG } from "../../api/ApiConfig";

export default function ConnectionRequests() {
    const { user } = useContext(AuthContext);
    const { setRequestCount } = useContext(RequestCountContext);
    const [requests, setRequests] = useState([]);

    const getFirstName = (name = "") => {
        return name.trim().split(/\s+/)[0];
    };


    // Fetch connection requests
    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const res = await axios.get(
                    API_ENDPOINTS.CONNECTION.GET_ALL,
                    AXIOS_CONFIG
                );
                setRequests(res.data);
            } catch (err) {
                console.log("Error fetching requests:", err);
            }
        };

        fetchRequests();
    }, []);

    // Handle Request Actions
    const handleAction = async (requestId, action) => {
        try {
            await axios.put(
                API_ENDPOINTS.CONNECTION.ACTION(action, requestId),
                {},
                AXIOS_CONFIG
            );
            const statusMap = {
                accept: "ACCEPTED",
                reject: "REJECTED",
                cancel: "CANCELLED",
            };

            setRequests((prev) =>
                prev.map((req) =>
                    req.requestId === requestId
                        ? { ...req, status: statusMap[action] }
                        : req
                )
            );
        } catch (error) {
            console.log("Action error →", error);
            alert(error.response?.data || "Something went wrong");
        }
    };

    const cancelRequest = async (requestId) => {

        await axios.delete(
            API_ENDPOINTS.CONNECTION.CANCEL(requestId),
            AXIOS_CONFIG
        );
    }

    return (
        <div className="cr-wrapper">
            <h2 className="cr-title">Connection Requests</h2>

            <div className="cr-list">
                {requests.length === 0 ? (
                    <p className="cr-empty">No connection requests.</p>
                ) : (
                    requests.map((req) => {
                        const loggedInUserId = user?.id;
                        const isRequester = req.requester.id === loggedInUserId;
                        const isTarget = req.target.id === loggedInUserId;

                        const displayUser = isRequester ? req.target : req.requester;

                        return (
                            <div key={req.requestId} className="cr-card">
                                {/* Request Date */}
                                <div className="cr-date">
                                    Requested on
                                    <p>{" "}</p>
                                    {new Date(req.createdAt).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </div>
                                {/* Profile Pic */}
                                <div className="cr-avatar-section">
                                    <img
                                        src={displayUser.profilePicture || "/assets/default-logo.png"}
                                        alt="profile"
                                        className="cr-avatar"
                                    />
                                </div>

                                {/* User Info */}
                                <div className="cr-info">
                                    <p className="cr-name">{displayUser.name}</p>
                                    <p className="cr-email">{displayUser.email}</p>
                                </div>


                                {/* Action Buttons */}
                                <div className="cr-action">
                                    {req.status === "PENDING" && isRequester && (
                                        <button
                                            className="cr-btn cr-cancel"
                                            onClick={() => cancelRequest(req.requestId)}
                                        >
                                            Cancel Request
                                        </button>
                                    )}

                                    {req.status === "PENDING" && isTarget && (
                                        <>
                                            <button
                                                className="cr-btn cr-accept"
                                                onClick={() => handleAction(req.requestId, "accept")}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                className="cr-btn cr-reject"
                                                onClick={() => handleAction(req.requestId, "reject")}
                                            >
                                                Reject
                                            </button>
                                        </>
                                    )}

                                    {req.status === "ACCEPTED" && (
                                        <p className="cr-connected">Connected</p>
                                    )}
                                    {req.status === "REJECTED" && (
                                        <p className="cr-rejected">{isRequester
                                            ? `Rejected by ${getFirstName(req.target.name)}`
                                            : "You rejected this request"}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
