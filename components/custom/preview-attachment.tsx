type Attachment = { url: string; name: string; contentType: string };

import { LoaderIcon } from "./icons";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
}: {
  attachment: Attachment;
  isUploading?: boolean;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div className="flex flex-col gap-2 max-w-16 sm:max-w-20">
      <div className="h-16 w-16 sm:h-20 sm:w-20 bg-card rounded border shadow-sm relative flex flex-col items-center justify-center overflow-hidden">
        {contentType ? (
          contentType.startsWith("image") ? (
            <img
              key={url}
              src={url}
              alt={name ?? "An image attachment"}
              className="rounded size-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground text-xs text-center p-1">
              {contentType.split("/")[1]?.toUpperCase() || "FILE"}
            </div>
          )
        ) : (
          <div className="text-muted-foreground text-xs">FILE</div>
        )}

        {isUploading && (
          <div className="animate-spin absolute text-primary">
            <LoaderIcon />
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground max-w-16 sm:max-w-20 truncate">{name}</div>
    </div>
  );
};
