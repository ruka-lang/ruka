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

const Timezone = enum(u8) {
    CST,
    EST,
    PST,
    UTC,

    pub fn toString(self: Timezone) []const u8 {
        return @tagName(self);
    }

    pub fn getOffset(self: Timezone) i64 {
        return offsetHoursFromUTC[@intFromEnum(self)];
    }

    pub const offsetHoursFromUTC = [_]i64{
        -6,
        -5,
        -8,
         0
    };
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

pub fn now(timezone: Timezone) Chrono {
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

    // Calculate current year
    while (days > 365 or isLeapYear(year) and days > 366) {
        if (isLeapYear(year)) {
            days -= 366;
            year += 1;
            continue;
        }

        days -= 365;
        year += 1;
    }

    // Calculate day and month
    while (moreDaysThanInMonth(days, month, year)) {
        days -= month.getDaysPerMonth(year);

        month.next();
    }

    self.day = @intCast(days + 1);
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

    self.hour = @intCast(@mod(hours + self.hour, 24));
    self.minute = @intCast(@mod(minutes + self.minute, 60));
    self.second = @intCast(@mod(seconds + self.second, 60));
    self.millisecond = @intCast(@mod(milliseconds + self.millisecond,  1000));
}

fn convertTimezone(self: *Chrono, timezone: Timezone) void {
    const offset = timezone.getOffset();

    if (offset < 0) {
        const hour = @mod(self.hour + offset, @as(i8, 24));
        self.hour = @intCast(hour);

        if (self.hour + offset < 0) {
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
        self.hour = @intCast(hour);
    }
}

fn daylightSavings(self: *Chrono) void {
    switch (self.timezone) {
        .UTC => {},
        else => {
            self.hour += @intFromBool(self.isDaylightSavings());

        }
    }
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
            return daysPerMonth[@intFromEnum(self)] + 1;
        } else {
            return daysPerMonth[@intFromEnum(self)];
        }
    }

    pub const daysPerMonth = [12]i16{31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
};

test "utc time after a trillion milliseconds" {
    const testing = std.testing;
    var chrono: Chrono = .epoch_unix;

    const milliseconds: i64 = 1_000_000_000_000;

    chrono.calculateDate(milliseconds);
    chrono.calculateTime(milliseconds);

    try testing.expectEqual(.UTC, chrono.timezone);
    try testing.expectEqual(1, chrono.hour);
    try testing.expectEqual(46, chrono.minute);
    try testing.expectEqual(40, chrono.second);
    try testing.expectEqual(0, chrono.millisecond);
    try testing.expectEqual(9, chrono.day);
    try testing.expectEqual(.sunday, chrono.weekday);
    try testing.expectEqual(.september, chrono.month);
    try testing.expectEqual(2001, chrono.year);
}

test "utc time after a ten trillion milliseconds" {
    const testing = std.testing;
    var chrono: Chrono = .epoch_unix;

    const milliseconds: i64 = 10_000_000_000_000;

    chrono.calculateDate(milliseconds);
    chrono.calculateTime(milliseconds);

    try testing.expectEqual(.UTC, chrono.timezone);
    try testing.expectEqual(17, chrono.hour);
    try testing.expectEqual(46, chrono.minute);
    try testing.expectEqual(40, chrono.second);
    try testing.expectEqual(0, chrono.millisecond);
    try testing.expectEqual(20, chrono.day);
    try testing.expectEqual(.saturday, chrono.weekday);
    try testing.expectEqual(.november, chrono.month);
    try testing.expectEqual(2286, chrono.year);
}
