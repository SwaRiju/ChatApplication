package com.example.chat.Service;

import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.chat.Model.Invitation;
import com.example.chat.Repository.InvitationRepo;
import com.example.chat.Repository.UserRepo;

@Service
public class InvitationService {

    @Autowired
    private BrevoEmailService brevoEmailService;

    @Autowired
    private UserRepo userRepo;

    @Autowired
    private InvitationRepo invitationRepo;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public void createInvitationEmail(String toEmail, String name, Long id) {

        Optional<Invitation> existing =
                invitationRepo.findBySenderIdAndReceiverEmail(id, toEmail);

        if (existing.isPresent()) {
            throw new RuntimeException("You have already invited this email");
        }

        String token = UUID.randomUUID().toString();

        Invitation invitation = new Invitation();
        invitation.setSenderId(id);
        invitation.setReceiverEmail(toEmail);
        invitation.setReceiverName(name);
        invitation.setToken(token);

        invitationRepo.save(invitation);

        // Do NOT use localhost in production
        String invitationLink =
                frontendUrl + "/login?invite=" + token;

        String fromName = userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Sender not found"))
                .getUsername();

        String subject =
                "Greetings " + name.trim() + " — You're Invited to Join ChatApp!";

        String emailBody =
                "Hello, " + name + ",\n\n"
                + "You have been invited to join ChatApp by "
                + fromName + ".\n\n"
                + "Click the link below to accept the invitation:\n"
                + invitationLink + "\n\n"
                + "Looking forward to seeing you there!\n\n"
                + "Best regards,\n"
                + "ChatApp Team";

        brevoEmailService.sendEmail(
                toEmail,
                subject,
                emailBody
        );

        System.out.println("✅ Invitation sent to: " + toEmail);
    }
}