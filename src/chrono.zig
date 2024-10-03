// @author: ruka-lang
// @created: 2024-09-13

const std = @import("std");

millisecond: u16,
second: u8,
minute: u8,
hour: u8,
day: u8,
weekday: Weekday,
month: Month,
year: isize,

timezone: Timezone,

const Chrono = @This();

const Timezone = enum {
    CST,
    EST,
    PST,
    UTC,

    pub fn toString(self: Timezone) []const u8 {
        return @tagName(self);
    }

    pub fn getOffset(self: Timezone) i64 {
        return offsetHoursFromUTC.get(self.toString()) orelse unreachable;
    }

    pub const offsetHoursFromUTC = std.StaticStringMap(i64).initComptime(.{
        .{"CST", -6},
        .{"EST", -5},
        .{"PST", -8},
        .{"UTC", 0}
    });
};

///
pub const epoch_unix = Chrono {
    .millisecond = 0,
    .second = 0,
    .minute = 0,
    .hour = 0,
    .day = 1,
    .weekday = .thursday,
    .month = .january,
    .year = 1970,
    .timezone = .UTC
};

pub fn initEpoch() Chrono {
    return epoch_unix;
}

// TODO daylight savings, leap seconds, add more timezones, formatting
pub fn init(timezone: Timezone) Chrono {
    var chrono = epoch_unix;
    chrono.timezone = timezone;

    const milliseconds = std.time.milliTimestamp();

    chrono.calculateDate(milliseconds);
    chrono.calculateTime(milliseconds);

    chrono.convertTimezone(timezone);

    chrono.daylightSavings();

    return chrono;
}

fn calculateDate(self: *Chrono, milliseconds: i64) void {
    var days = @divTrunc(milliseconds, 1000 * 60 * 60 * 24);
    self.weekday.advance(days);

    var month = epoch_unix.month;
    var year = epoch_unix.year;

    while (moreDaysThanInMonth(days, month, year)) {
        days -= month.getDaysPerMonth(year);

        month.next();

        if (month == .january) {
            year += 1;
        }
    }

    self.day = @as(u8, @intCast(days + 1));
    self.month = month;
    self.year = year;
}

fn moreDaysThanInMonth(days: i64, month: Month, year: i64) bool {
    return days > month.getDaysPerMonth(year);
}

fn isLeapYear(year: i64) bool {
    return @mod(year, 4) == 0
        and (!(@mod(year, 100) == 0)
        or @mod(year, 400) == 0);
}

fn calculateTime(self: *Chrono, milliseconds: i64) void {
    const seconds = @divTrunc(milliseconds, 1000);
    const minutes = @divTrunc(milliseconds, 1000 * 60);
    const hours = @divTrunc(milliseconds, 1000 * 60 * 60);

    self.hour = @as(u8, @intCast(@mod(hours + self.hour, 24)));
    self.minute = @as(u8, @intCast(@mod(minutes + self.minute, 60)));
    self.second = @as(u8, @intCast(@mod(seconds + self.second, 60)));
    self.millisecond = @as(u16, @intCast(@mod(milliseconds + self.millisecond,  1000)));
}

fn convertTimezone(self: *Chrono, timezone: Timezone) void {
    const offset = timezone.getOffset();

    if (offset < 0) {
        const hour = @mod(self.hour + offset, @as(i8, 24));
        self.hour = @as(u8, @intCast(hour));

        if (self.hour + offset < 0) {
            self.hour = 23;
            if (self.day - 1 == 0) {
                self.month.previous();
                self.day = @intCast(self.month.getDaysPerMonth(self.year));

                if (self.month == .december) {
                    self.year -= 1;
                }
            }
        }
    } else if (offset == 24) {
        self.day += 1;
        self.weekday.advance(1);
    } else if (offset > 0 and offset < 24) {
        const hour = @mod(self.hour + offset, @as(i8, 24));
        self.hour = @as(u8, @intCast(hour));
    }
}

fn daylightSavings(self: *Chrono) void {
    if (self.isDaylightSavings()) self.hour += 1;
}

// If between second sunday of march and first sunday of november, and an hour
// Otherwise do nothing
fn isDaylightSavings(self: Chrono) bool {
    _ = self;
    return true;
}

pub const Weekday = enum(u8) {
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday,

    pub fn toString(self: Weekday) []const u8 {
        return @tagName(self);
    }

    pub fn advance(self: *Weekday, days: i64) void {
        self.* = @enumFromInt(@mod(days + @intFromEnum(self.*), 7));
    }
};

pub const Month = enum(u8) {
    january,
    february,
    march,
    april,
    may,
    june,
    july,
    august,
    september,
    october,
    november,
    december,

    pub fn next(self: *Month) void {
        self.* = @enumFromInt((@intFromEnum(self.*) + 1) % 12);
    }

    pub fn previous(self: *Month) void {
        self.* = @enumFromInt((@intFromEnum(self.*) - 1) % 12);
    }

    pub fn toString(self: Month) []const u8 {
        return @tagName(self);
    }

    pub fn getDaysPerMonth(self: Month, year: i64) i16 {
        if (isLeapYear(year) and self == .february) {
            return daysPerMonth.get(self.toString()).? + 1;
        } else {
            return daysPerMonth.get(self.toString()).?;
        }
    }

    pub const daysPerMonth = std.StaticStringMap(i16).initComptime(.{
        .{"january", 31},
        .{"february", 28}, //29 on a leap year
        .{"march", 31},
        .{"april", 30},
        .{"may", 31},
        .{"june", 30},
        .{"july", 31},
        .{"august", 31},
        .{"september", 30},
        .{"october", 31},
        .{"november", 30},
        .{"december", 31}
    });
};

test "test chrono module" {
    _ = tests;
}

const tests = struct {
    const testing = std.testing;
    const allocator = testing.allocator;

    test "epoch initialization" {
        const chrono = Chrono.init(.PST);
        std.debug.print("{}\n", .{chrono});
        try testing.expect(chrono.timezone == .PST);
    }
};
