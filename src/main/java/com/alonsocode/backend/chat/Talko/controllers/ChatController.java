package com.alonsocode.backend.chat.Talko.controllers;

import java.util.Date;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import com.alonsocode.backend.chat.Talko.models.Message;

/**
 * Controlador para manejar mensajes del chat en tiempo real
 * Usa WebSocket con STOMP para comunicación bidireccional
 */
@Controller
public class ChatController {

    // Paleta de colores para asignar a los usuarios
    private String[] colors = {
        "#FF5733", // Rojo coral
        "#33FF57", // Verde brillante
        "#3357FF", // Azul eléctrico
        "#FF33F5", // Magenta
        "#33FFF5", // Cian
        "#FFD700", // Dorado
        "#FF6B35", // Naranja
        "#9B59B6", // Púrpura
        "#1ABC9C", // Turquesa
        "#E74C3C"  // Rojo
    };

    // Mapa para almacenar usuarios activos y sus colores
    private ConcurrentHashMap<String, String> activeUsers = new ConcurrentHashMap<>();

    /**
     * Recibe mensajes del cliente y los retransmite a todos los suscriptores
     */
    @MessageMapping("/message")
    @SendTo("/chat/message")
    public Message receiveMessage(Message message) {
        
        // Establecer la fecha/hora actual del servidor
        message.setDate(new Date().getTime());
        
        // Procesar según el tipo de mensaje
        if ("NEW_USER".equals(message.getType())) {
            // ===== NUEVO USUARIO =====
            
            // Asignar un color aleatorio de la paleta
            String assignedColor = this.colors[new Random().nextInt(colors.length)];
            message.setColor(assignedColor);
            
            // Guardar usuario activo con su color
            activeUsers.put(message.getSender(), assignedColor);
            
            // Establecer mensaje de sistema
            message.setText(message.getSender() + " se ha unido al chat");
            
            System.out.println("🆕 Nuevo usuario conectado: " + message.getSender() + 
                             " | Color: " + assignedColor);
            System.out.println("👥 Usuarios activos: " + activeUsers.size());
        } 
        else if ("MESSAGE".equals(message.getType())) {
            // ===== MENSAJE NORMAL =====
            
            // Recuperar color del usuario si existe
            String userColor = activeUsers.get(message.getSender());
            if (userColor != null) {
                message.setColor(userColor);
            }
            
            System.out.println("💬 Mensaje de " + message.getSender() + ": " + message.getText());
        }
        else if ("USER_LEFT".equals(message.getType())) {
            // ===== USUARIO ABANDONA EL CHAT =====
            
            // Recuperar color del usuario si existe
            String userColor = activeUsers.get(message.getSender());
            if (userColor != null) {
                message.setColor(userColor);
            }
            
            // Remover usuario activo
            activeUsers.remove(message.getSender());
            
            // Establecer mensaje de sistema
            message.setText(message.getSender() + " ha dejado el chat");
            
            System.out.println("👋 Usuario desconectado: " + message.getSender());
            System.out.println("👥 Usuarios activos: " + activeUsers.size());
        }
        else {
            // ===== TIPO DESCONOCIDO =====
            System.out.println("⚠️  Tipo de mensaje desconocido: " + message.getType());
        }
        
        return message;
    }

    /**
     * Maneja eventos de typing (usuario escribiendo)
     * Recibe eventos cuando un usuario empieza o deja de escribir
     */
    @MessageMapping("/typing")
    @SendTo("/chat/typing")
    public Message handleTyping(Message message) {
        
        // Establecer la fecha/hora actual del servidor
        message.setDate(new Date().getTime());
        
        // Recuperar color del usuario si existe
        String userColor = activeUsers.get(message.getSender());
        if (userColor != null) {
            message.setColor(userColor);
        } else {
            // Si el usuario no está en activeUsers, asignar color temporal
            String assignedColor = this.colors[new Random().nextInt(colors.length)];
            message.setColor(assignedColor);
        }
        
        // Procesar según el tipo de evento de typing
        if ("TYPING_START".equals(message.getType())) {
            System.out.println("✍️ " + message.getSender() + " está escribiendo...");
        } 
        else if ("TYPING_STOP".equals(message.getType())) {
            System.out.println("💤 " + message.getSender() + " dejó de escribir");
        }
        else {
            System.out.println("⚠️  Tipo de evento de typing desconocido: " + message.getType());
        }
        
        return message;
    }

    /**
     * Método auxiliar para obtener el color de un usuario
     */
    
}
