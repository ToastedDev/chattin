export interface Message {
  id: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    badges: {
      moderator: boolean;
      verified: boolean;
      owner: boolean;
    };
  };
}

export interface Tab {
  id: string;
  title: string;
  channelId?: string;
  videoId?: string;
}

export interface User {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  token: string;
}
