package com.example.chat.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.chat.Repository.InvitationRepo;
import com.example.chat.Repository.UserRepo;

@Service
public class NotificationService {

    @Autowired
    private BrevoEmailService brevoEmailService;

    @Autowired
    private UserRepo userRepo;

    @Autowired
    private InvitationRepo invitationRepo;

    public void notifyUser(Long userId, String message) {

        String userEmail = userRepo.findEmailById(userId)
                .orElseThrow(() -> new RuntimeException("User email not found"))
                .getEmail();

        String nameOfAcceptedUser =
                invitationRepo.findBySenderId(userId)
                        .orElseThrow(() -> new RuntimeException("Invitation not found"))
                        .getReceiverName();

        String subject =
                nameOfAcceptedUser + " Accepted your Invitation!";

        String emailBody =
                "Greetings!\n\n"
                + message + "\n\n"
                + "Start chatting by sending a connection request.\n\n"
                + "Best regards,\n"
                + "ChatApp Team";

        brevoEmailService.sendEmail(
                userEmail,
                subject,
                emailBody
        );

        System.out.println(
                "Notifying user " + userId + ": " + message
        );
    }
}