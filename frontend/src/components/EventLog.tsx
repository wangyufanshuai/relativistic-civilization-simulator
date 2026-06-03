import type { SimEvent } from "../types/sim";

export function EventLog({ events }: { events: SimEvent[] }) {
  return (
    <section className="eventLog">
      <div className="panelHeader">
        <span>events</span>
        <strong>{events.length}</strong>
      </div>
      <div className="eventList">
        {events.length === 0 ? (
          <p className="empty">No recent events. Advance time to expose delayed politics.</p>
        ) : (
          events
            .slice()
            .reverse()
            .slice(0, 12)
            .map((event, index) => (
              <article key={`${event.year}-${event.title}-${index}`} className={`eventItem ${event.event_type}`}>
                <span>{event.year}</span>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.description}</p>
                </div>
              </article>
            ))
        )}
      </div>
    </section>
  );
}

