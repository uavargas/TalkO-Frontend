export class Message {
    text: string = '';
    date!: Date;
    username: string = '';
    type!: string; // 'JOIN', 'LEAVE', 'CHAT'
    color !: string;
}
    