export interface Message {
  id: string;
  content: string;
  author: {
    name: string;
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
