package com.example.prononciationtest.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "mail_settings")
public class MailSettings {

    @Id
    private Long id = 1L; // singleton row

    @Column(nullable = false)
    private String host = "smtp.office365.com";

    @Column(nullable = false)
    private int port = 587;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String fromName = "SpeakCoach AI";

    public Long getId()            { return id; }
    public String getHost()        { return host; }
    public int getPort()           { return port; }
    public String getUsername()    { return username; }
    public String getPassword()    { return password; }
    public String getFromName()    { return fromName; }

    public void setHost(String host)         { this.host = host; }
    public void setPort(int port)            { this.port = port; }
    public void setUsername(String username) { this.username = username; }
    public void setPassword(String password) { this.password = password; }
    public void setFromName(String fromName) { this.fromName = fromName; }
}
