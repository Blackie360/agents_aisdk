"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { motion } from "framer-motion";

import { BotIcon, UserIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";
import { AuthorizePayment } from "../flights/authorize-payment";
import { DisplayBoardingPass } from "../flights/boarding-pass";
import { CreateReservation } from "../flights/create-reservation";
import { FlightStatus } from "../flights/flight-status";
import { ListFlights } from "../flights/list-flights";
import { SelectSeats } from "../flights/select-seats";
import { VerifyPayment } from "../flights/verify-payment";

export const Message = ({
  chatId,
  message,
}: {
  chatId: string;
  message: UIMessage;
}) => {
  const { role, parts } = message;

  return (
    <motion.div
      className={`flex flex-row gap-4 px-4 w-full md:w-[500px] md:px-0 first-of-type:pt-20`}
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="size-[24px] border rounded-sm p-1 flex flex-col justify-center items-center shrink-0 text-zinc-500">
        {role === "assistant" ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex flex-col gap-2 w-full">
        {parts.map((part, index) => {
          switch (part.type) {
            case "text":
              return (
                <div
                  key={index}
                  className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4"
                >
                  <Markdown>{part.text}</Markdown>
                </div>
              );

            case "file":
              return (
                <PreviewAttachment
                  key={index}
                  attachment={{
                    url: part.url,
                    contentType: part.mediaType,
                  }}
                />
              );

            default:
              // Handle tool invocations
              if (isToolUIPart(part)) {
                const toolName = getToolName(part);
                const { toolCallId, state, output } = part;

                if (state === "output-available" && output !== undefined) {
                  return (
                    <div key={toolCallId}>
                      {toolName === "getWeather" ? (
                        <Weather weatherAtLocation={output} />
                      ) : toolName === "displayFlightStatus" ? (
                        <FlightStatus flightStatus={output} />
                      ) : toolName === "searchFlights" ? (
                        <ListFlights chatId={chatId} results={output} />
                      ) : toolName === "selectSeats" ? (
                        <SelectSeats chatId={chatId} availability={output} />
                      ) : toolName === "createReservation" ? (
                        Object.keys(output).includes("error") ? null : (
                          <CreateReservation reservation={output} />
                        )
                      ) : toolName === "authorizePayment" ? (
                        <AuthorizePayment intent={output} />
                      ) : toolName === "displayBoardingPass" ? (
                        <DisplayBoardingPass boardingPass={output} />
                      ) : toolName === "verifyPayment" ? (
                        <VerifyPayment result={output} />
                      ) : (
                        <div>{JSON.stringify(output, null, 2)}</div>
                      )}
                    </div>
                  );
                } else {
                  // Tool is still loading/calling
                  return (
                    <div key={toolCallId} className="skeleton">
                      {toolName === "getWeather" ? (
                        <Weather />
                      ) : toolName === "displayFlightStatus" ? (
                        <FlightStatus />
                      ) : toolName === "searchFlights" ? (
                        <ListFlights chatId={chatId} />
                      ) : toolName === "selectSeats" ? (
                        <SelectSeats chatId={chatId} />
                      ) : toolName === "createReservation" ? (
                        <CreateReservation />
                      ) : toolName === "authorizePayment" ? (
                        <AuthorizePayment />
                      ) : toolName === "displayBoardingPass" ? (
                        <DisplayBoardingPass />
                      ) : null}
                    </div>
                  );
                }
              }
              return null;
          }
        })}
      </div>
    </motion.div>
  );
};
