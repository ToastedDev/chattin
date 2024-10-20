import type { Tab } from "@shared/types";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  channel: z.string().optional(),
  video: z.string().optional(),
}).refine(
  data => (data.channel && !data.video) || (!data.channel && data.video),
  { message: "Exactly one of channelId or videoId must be provided." },
);

export function Header() {
  const navigate = useNavigate();
  const url = useRouterState({
    select: state => state.location,
  });
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState<boolean>();

  const { data: tabs } = useQuery({
    queryKey: ["tabs"],
    queryFn: () => window.electron.ipcRenderer.invoke("get-tabs") as Promise<Tab[]>,
  });

  const { mutate } = useMutation({
    mutationFn: async (tab: Tab) =>
      window.electron.ipcRenderer.send("add-tab", tab),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tabs"] }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      channel: "",
      video: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.channel && values.channel.length > 0) {
      const urlOrId = values.channel;
      const channel = await window.electron.ipcRenderer.invoke("get-channel", urlOrId);

      mutate({
        id: Math.random().toString(36).slice(0, 8),
        title: channel.name,
        channelId: channel.id,
      });
      setIsOpen(false);
      if (url.pathname !== "/chat") {
        navigate({
          to: "/chat",
          search: {
            channelId: channel.id,
          },
        });
      }
    }
    else if (values.video && values.video.length > 0) {
      const urlOrId = values.video;
      const video = await window.electron.ipcRenderer.invoke("get-video", urlOrId);

      mutate({
        id: Math.random().toString(36).slice(0, 8),
        title: video.title,
        channelId: video.id,
      });
      setIsOpen(false);
      if (url.pathname !== "/chat") {
        navigate({
          to: "/chat",
          search: {
            videoId: video.id,
          },
        });
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      {
        tabs?.map(tab => (
          <Link
            key={tab.id}
            to="/chat"
            search={prev => ({
              ...prev,
              channelId: tab.channelId,
              videoId: tab.videoId,
            })}
            className="bg-muted px-2 py-1 rounded-t-lg max-w-48 truncate aria-[current=page]:bg-muted/30"
          >
            {tab.title}
          </Link>
        ))
      }
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger className="py-1">
          <Plus className="h-6 w-6" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add chat</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel</FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/@toastedthedev" {...field} />
                    </FormControl>
                    <FormDescription>
                      A YouTube channel URL.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="video"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video</FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/watch?v=dQw4w9WgXcQ" {...field} />
                    </FormControl>
                    <FormDescription>
                      A YouTube stream URL.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Submit</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
