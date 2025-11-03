package com.alonsocode.backend.chat.Talko.models;

/**
 * Modelo que representa un mensaje en el chat
 * Se serializa a JSON para enviar entre cliente y servidor
 */
public class Message {
    
    // Nombre del usuario que envía el mensaje
    private String sender;
    
    // Contenido del mensaje
    private String text;
    
    // Timestamp en milisegundos desde epoch
    private Long date;
    
    // Color hexadecimal asignado al usuario (ej: "#FF5733")
    private String color;
    
    // Tipo de mensaje: "MESSAGE" o "NEW_USER"
    private String type;

    // ===== CONSTRUCTORES =====
    
    public Message() {
        // Constructor vacío requerido para deserialización JSON
    }

    public Message(String sender, String text, Long date, String color, String type) {
        this.sender = sender;
        this.text = text;
        this.date = date;
        this.color = color;
        this.type = type;
    }

    // ===== GETTERS Y SETTERS =====
    
    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public Long getDate() {
        return date;
    }

    public void setDate(Long date) {
        this.date = date;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    // ===== MÉTODOS ÚTILES =====
    
    @Override
    public String toString() {
        return "Message{" +
                "sender='" + sender + '\'' +
                ", text='" + text + '\'' +
                ", date=" + date +
                ", color='" + color + '\'' +
                ", type='" + type + '\'' +
                '}';
    }
}