"use client";

type RideCard = {
  id: string;
  from: string;
  to: string;
  eta: string;
  price: string;
  seats: number;
  driver?: {
    name: string;
    rating: number;
    vehicle: string;
    plate: string;
  };
  status?: "searching" | "accepted" | "en_route" | "arriving";
};

type RideRequestCardProps = {
  ride: RideCard;
  onAccept?: (rideId: string) => void;
  onDecline?: (rideId: string) => void;
};

export function RideRequestCard({
  ride,
  onAccept,
  onDecline,
}: RideRequestCardProps) {
  const statusStyles: Record<string, string> = {
    searching: "bg-amber-50 text-amber-700",
    accepted: "bg-emerald-50 text-emerald-700",
    en_route: "bg-sky-50 text-sky-700",
    arriving: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs">
              A
            </div>
            <span className="text-sm font-medium">{ride.from}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-8 bg-line" />
              <svg
                className="h-4 w-4 text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
              <div className="h-0.5 w-8 bg-line" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-primary text-xs">
              B
            </div>
            <span className="text-sm font-medium">{ride.to}</span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-semibold text-primary">{ride.price}</p>
          <p className="text-xs text-muted mt-1">ETA {ride.eta}</p>
          <p className="text-xs text-muted">{ride.seats} seat(s)</p>
        </div>
      </div>

      {ride.driver && (
        <div className="border-t border-line pt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                {ride.driver.name[0]}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">{ride.driver.name}</p>
                <p className="text-xs text-muted flex items-center gap-1">
                  <span>⭐ {ride.driver.rating}</span>
                </p>
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="font-medium">{ride.driver.vehicle}</p>
              <p className="text-muted">{ride.driver.plate}</p>
            </div>
          </div>
        </div>
      )}

      {ride.status && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              statusStyles[ride.status]
            }`}
          >
            {ride.status === "searching"
              ? "Finding Driver..."
              : ride.status === "accepted"
              ? "Driver Accepted"
              : ride.status === "en_route"
              ? "Driver En Route"
              : "Arriving"}
          </span>
        </div>
      )}

      {onAccept && onDecline && (
        <div className="flex gap-2 pt-4 border-t border-line">
          <button
            onClick={() => onDecline(ride.id)}
            className="flex-1 rounded-lg border border-line py-2.5 font-medium text-sm hover:bg-surface-soft transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => onAccept(ride.id)}
            className="flex-1 rounded-lg bg-primary py-2.5 font-medium text-sm text-white hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
        </div>
      )}
    </div>
  );
}
