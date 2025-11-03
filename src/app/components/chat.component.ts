import { Component, ElementRef, ViewChild, OnDestroy, OnInit, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import * as Stomp from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

// Interfaces
interface ChatMessage {
  sender: string;
  text: string;
  date: number;
  color?: string;
  type: 'MESSAGE' | 'NEW_USER' | 'USER_LEFT' | 'TYPING_START' | 'TYPING_STOP';
}

interface TypingUser {
  username: string;
  color: string;
  timestamp: number;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('scrollMe') private scrollContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  // Datos del chat
  messages: Array<{
    username: string;
    text: string;
    date: Date;
    color: string;
    type: string;
    isSystemMessage?: boolean;
  }> = [];

  currentUser: string = '';
  currentUserColor: string = '#000000';
  tempUsername: string = '';
  isEditingUsername: boolean = true;

  // WebSocket
  client!: Stomp.Client;
  connected: boolean = false;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';

  // Mensaje actual
  message: { text: string } = { text: '' };

  // Control de UI
  private shouldScroll: boolean = true;
  private connectionTimeout: any;

  // Indicador de escritura
  private typingSubject = new Subject<string>();
  private typingSubscription!: Subscription;
  isTyping: boolean = false;
  typingUsers: TypingUser[] = [];
  private typingTimeout: any;
  private readonly TYPING_TIMEOUT = 3000;

  ngOnInit(): void {
    this.generateUsername();
    this.tempUsername = this.currentUser;
    this.initializeWebSocketConnection();
    this.setupTypingDetection();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
    if (this.typingSubscription) this.typingSubscription.unsubscribe();
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }

  // === CONFIGURACIÓN WEBSOCKET ===
  private initializeWebSocketConnection(): void {
    this.client = new Stomp.Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/chat-websocket'),
      debug: (str) => {
        if (!str.includes('HEARTBEAT')) {
          console.log('STOMP:', str);
        }
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      
      onConnect: (frame) => {
        this.connected = true;
        this.connectionStatus = 'connected';
        console.log('✅ Conectado al chat:', frame);

        // Suscripciones a los topics
        this.client.subscribe('/chat/message', (message) => {
          this.handleIncomingMessage(message);
        });

        this.client.subscribe('/chat/typing', (message) => {
          this.handleTypingEvent(message);
        });

        this.announceNewUser();
        
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
        }
      },
      
      onDisconnect: (frame) => {
        this.connected = false;
        this.connectionStatus = 'disconnected';
        this.typingUsers = [];
        console.log('❌ Desconectado del chat:', frame);
      },
      
      onStompError: (frame) => {
        console.error('🚨 Error STOMP:', frame.headers['message']);
        this.connectionStatus = 'error';
      },
      
      onWebSocketError: (event) => {
        console.error('🚨 Error WebSocket:', event);
        this.connectionStatus = 'error';
        alert('❌ No se pudo conectar al servidor.');
      }
    });
  }

  // === MANEJO DE MENSAJES ===
  private handleIncomingMessage(stompMessage: any): void {
    try {
      const receivedMessage: ChatMessage = JSON.parse(stompMessage.body);
      
      const isSystemMessage = receivedMessage.type === 'NEW_USER' || receivedMessage.type === 'USER_LEFT';
      
      // Guardar color asignado por el backend
      if (receivedMessage.type === 'NEW_USER' && receivedMessage.sender === this.currentUser && receivedMessage.color) {
        this.currentUserColor = receivedMessage.color;
        console.log(`🎨 Color asignado: ${this.currentUserColor}`);
      }

      // Agregar mensaje a la lista
      this.messages.push({
        username: receivedMessage.sender || 'Desconocido',
        text: receivedMessage.text,
        date: new Date(receivedMessage.date || Date.now()),
        color: receivedMessage.color || '#000000',
        type: receivedMessage.type,
        isSystemMessage: isSystemMessage
      });

      // Limitar mensajes para rendimiento
      if (this.messages.length > 200) {
        this.messages = this.messages.slice(-150);
      }

      this.shouldScroll = true;
      
    } catch (error) {
      console.error('❌ Error al procesar mensaje:', error);
    }
  }

  private announceNewUser(): void {
    const newUserMessage: ChatMessage = {
      sender: this.currentUser,
      text: '',
      date: Date.now(),
      type: 'NEW_USER'
    };

    this.client.publish({
      destination: '/app/message',
      body: JSON.stringify(newUserMessage)
    });
  }

  // === INDICADOR DE ESCRIBIENDO ===
  private setupTypingDetection(): void {
    this.typingSubscription = this.typingSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      this.handleTypingState();
    });
  }

  private handleTypingState(): void {
    if (!this.connected) return;

    const wasTyping = this.isTyping;
    this.isTyping = this.message.text.length > 0;

    if (wasTyping !== this.isTyping) {
      this.sendTypingEvent(this.isTyping);
    }

    if (this.isTyping) {
      if (this.typingTimeout) clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        this.isTyping = false;
        this.sendTypingEvent(false);
      }, this.TYPING_TIMEOUT);
    }
  }

  private sendTypingEvent(isTyping: boolean): void {
    if (!this.connected) return;

    const typingMessage: ChatMessage = {
      sender: this.currentUser,
      text: isTyping ? 'TYPING_START' : 'TYPING_STOP',
      date: Date.now(),
      color: this.currentUserColor,
      type: isTyping ? 'TYPING_START' : 'TYPING_STOP'
    };

    this.client.publish({
      destination: '/app/typing',
      body: JSON.stringify(typingMessage)
    });
  }

  private handleTypingEvent(stompMessage: any): void {
    try {
      const receivedMessage: ChatMessage = JSON.parse(stompMessage.body);
      
      if (receivedMessage.sender === this.currentUser) return;

      const now = Date.now();
      const userIndex = this.typingUsers.findIndex(user => user.username === receivedMessage.sender);

      if (receivedMessage.type === 'TYPING_START') {
        const typingUser: TypingUser = {
          username: receivedMessage.sender,
          color: receivedMessage.color || '#000000',
          timestamp: now
        };

        if (userIndex >= 0) {
          this.typingUsers[userIndex] = typingUser;
        } else {
          this.typingUsers.push(typingUser);
        }
      } else if (receivedMessage.type === 'TYPING_STOP' && userIndex >= 0) {
        this.typingUsers.splice(userIndex, 1);
      }

      this.cleanupTypingUsers();

    } catch (error) {
      console.error('❌ Error en evento typing:', error);
    }
  }

  private cleanupTypingUsers(): void {
    const now = Date.now();
    this.typingUsers = this.typingUsers.filter(user => 
      (now - user.timestamp) < (this.TYPING_TIMEOUT + 2000)
    );
  }

  getTypingText(): string {
    const count = this.typingUsers.length;
    if (count === 0) return '';
    if (count === 1) return `${this.typingUsers[0].username} está escribiendo...`;
    if (count === 2) return `${this.typingUsers[0].username} y ${this.typingUsers[1].username} están escribiendo...`;
    return `${this.typingUsers[0].username} y ${count - 1} más están escribiendo...`;
  }

  // === MÉTODOS PÚBLICOS ===
  connect(): void {
    if (this.isEditingUsername) {
      alert('⚠️ Establece tu nombre de usuario primero');
      return;
    }

    if (!this.currentUser.trim()) {
      alert('⚠️ Nombre de usuario inválido');
      this.enableEditUsername();
      return;
    }

    if (!this.connected) {
      console.log('🔌 Conectando...');
      this.connectionStatus = 'connecting';
      
      this.connectionTimeout = setTimeout(() => {
        if (this.connectionStatus === 'connecting') {
          this.connectionStatus = 'error';
          alert('❌ Timeout de conexión');
        }
      }, 10000);
      
      this.client.activate();
    }
  }

  disconnect(): void {
    if (this.connected && this.client) {
      console.log('🔌 Desconectando...');
      
      if (this.isTyping) {
        this.sendTypingEvent(false);
      }
      
      const leaveMessage: ChatMessage = {
        sender: this.currentUser,
        text: '',
        date: Date.now(),
        color: this.currentUserColor,
        type: 'USER_LEFT'
      };
      
      try {
        this.client.publish({
          destination: '/app/message',
          body: JSON.stringify(leaveMessage)
        });
      } catch (e) {
        console.log('No se pudo enviar mensaje de desconexión');
      }
      
      this.client.deactivate();
      this.connected = false;
      this.connectionStatus = 'disconnected';
      this.typingUsers = [];
    }
  }

  onSendMessage(): void {
    if (!this.message.text.trim()) return;

    const chatMessage: ChatMessage = {
      sender: this.currentUser,
      text: this.message.text.trim(),
      date: Date.now(),
      color: this.currentUserColor,
      type: 'MESSAGE'
    };

    this.client.publish({
      destination: '/app/message',
      body: JSON.stringify(chatMessage)
    });

    this.message.text = '';
    this.shouldScroll = true;
    
    if (this.isTyping) {
      this.isTyping = false;
      this.sendTypingEvent(false);
    }
  }

  // === MÉTODOS AUXILIARES ===
  private generateUsername(): void {
    const timestamp = Date.now().toString().slice(-6);
    this.currentUser = `Usuario_${timestamp}`;
  }

  setUsername(): void {
    const trimmedName = this.tempUsername.trim();
    
    if (trimmedName.length < 3 || trimmedName.length > 20) {
      alert('⚠️ El nombre debe tener entre 3 y 20 caracteres');
      return;
    }

    const validNamePattern = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_\-\s]+$/;
    if (!validNamePattern.test(trimmedName)) {
      alert('⚠️ Solo letras, números, guiones y guiones bajos');
      return;
    }

    this.currentUser = trimmedName;
    this.isEditingUsername = false;
  }

  enableEditUsername(): void {
    if (this.connected) {
      alert('⚠️ Desconéctate primero para cambiar tu nombre');
      return;
    }
    this.tempUsername = this.currentUser;
    this.isEditingUsername = true;
  }

  cancelEditUsername(): void {
    this.tempUsername = this.currentUser;
    this.isEditingUsername = false;
  }

  onMessageInput(): void {
    this.typingSubject.next(this.message.text);
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('❌ Error en scroll:', err);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    } else {
      this.onMessageInput();
    }
  }

  onUsernameKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.setUsername();
    }
  }

  isMyMessage(username: string): boolean {
    return username === this.currentUser;
  }

  trackByMessage(index: number, message: any): any {
    return `${message.username}_${message.date}_${message.text}`;
  }

  clearMessages(): void {
    if (confirm('¿Limpiar todos los mensajes?')) {
      this.messages = [];
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}