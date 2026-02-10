const statusEl = document.getElementById("status");
const btnFetch = document.getElementById("btnFetch");
const adm4Input = document.getElementById("adm4");
const provinsiSelect = document.getElementById("provinsi");
const kabupatenSelect = document.getElementById("kabupaten");
const kecamatanSelect = document.getElementById("kecamatan");
const desaSelect = document.getElementById("desa");
const adm4Hint = document.getElementById("adm4Hint");

const ui = {
    localTime: document.getElementById("localTime"),
    utcTime: document.getElementById("utcTime"),
    weatherDesc: document.getElementById("weatherDesc"),
    weatherDescEn: document.getElementById("weatherDescEn"),
    temp: document.getElementById("temp"),
    humidity: document.getElementById("humidity"),
    wind: document.getElementById("wind"),
    windDir: document.getElementById("windDir"),
    cloud: document.getElementById("cloud"),
    visibility: document.getElementById("visibility"),
    analysis: document.getElementById("analysis"),
    forecastList: document.getElementById("forecastList"),
};

const wilayahCache = new Map();

function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
}

function renderSummary(item) {
    ui.localTime.textContent = item.local_datetime || "-";
    ui.utcTime.textContent = `UTC: ${item.utc_datetime || "-"}`;
    ui.weatherDesc.textContent = `${getWeatherIcon(item.weather_desc)} ${item.weather_desc || "-"}`;
    ui.weatherDescEn.textContent = item.weather_desc_en || "-";
    ui.temp.textContent = item.t ? `${item.t}°C` : "-";
    ui.humidity.textContent = item.hu ? `${item.hu}% kelembapan` : "-";
    ui.wind.textContent = item.ws ? `${item.ws} km/jam` : "-";
    ui.windDir.textContent = item.wd ? `Arah: ${item.wd}` : "-";
    ui.cloud.textContent = item.tcc ? `${item.tcc}%` : "-";
    ui.visibility.textContent = item.vs_text ? `Visibilitas: ${item.vs_text}` : "-";
    ui.analysis.textContent = item.analysis_date || "-";
}

function renderForecast(list) {
    ui.forecastList.innerHTML = "";
    if (!list.length) {
        ui.forecastList.innerHTML =
            '<div class="row"><div class="main">Tidak ada data prakiraan.</div><span>-</span><span>-</span></div>';
        return;
    }

    list.slice(0, 8).forEach((item) => {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `
    <div>
      <div class="main">${item.local_datetime || "-"}</div>
    </div>
    <span>${item.t ? `${item.t}°C` : "-"} / ${item.hu ? `${item.hu}%` : "-"}</span>
    <span>${item.ws ? `${item.ws} km/jam` : "-"} | ${item.wd || "-"}</span>
    <span>${getWeatherIcon(item.weather_desc)} ${item.weather_desc || "-"}</span>
  `;
        ui.forecastList.appendChild(row);
    });
}

function getWeatherIcon(description = "") {
    const text = description.toLowerCase();
    if (text.includes("badai") || text.includes("petir")) return "⛈️";
    if (text.includes("hujan lebat")) return "🌧️";
    if (text.includes("hujan ringan") || text.includes("hujan")) return "🌦️";
    if (text.includes("mendung tebal") || text.includes("mendung")) return "☁️";
    if (text.includes("berawan")) return "⛅";
    if (text.includes("cerah berawan")) return "🌤️";
    if (text.includes("cerah")) return "☀️";
    if (text.includes("kabut") || text.includes("asap")) return "🌫️";
    if (text.includes("angin kencang")) return "💨";
    return "🌥️";
}

function extractForecast(payload) {
    if (!payload || !payload.data) return [];
    const dataArray = Array.isArray(payload.data)
        ? payload.data
        : [payload.data];
    const items = [];

    dataArray.forEach((item) => {
        if (item?.cuaca) {
            const cuaca = Array.isArray(item.cuaca)
                ? item.cuaca.flat()
                : [];
            cuaca.forEach((entry) => items.push(entry));
        }
    });

    return items.sort((a, b) => {
        const aTime = new Date(a.local_datetime || 0).getTime();
        const bTime = new Date(b.local_datetime || 0).getTime();
        return aTime - bTime;
    });
}

function fillSelect(select, items, placeholder) {
    select.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = placeholder;
    select.appendChild(first);

    items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.code;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

function sortByName(list) {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

function resetWilayah() {
    fillSelect(kabupatenSelect, [], "Pilih kabupaten/kota");
    fillSelect(kecamatanSelect, [], "Pilih kecamatan");
    fillSelect(desaSelect, [], "Pilih desa/kelurahan");
    kabupatenSelect.disabled = true;
    kecamatanSelect.disabled = true;
    desaSelect.disabled = true;
    adm4Input.value = "";
}

async function loadWilayahByProvince(provinceFile) {
    const cached = wilayahCache.get(provinceFile);
    if (cached) return cached;

    const url = `https://unpkg.com/administratif-indonesia@0.2.0/storages/${provinceFile}.json`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Gagal memuat daftar wilayah.");
    }
    const data = await response.json();

    const state = {
        kabupaten: [],
        kecByKab: new Map(),
        desaByKec: new Map(),
    };

    data.forEach((item) => {
        if (!item?.code || !item?.name) return;
        const segments = item.code.split(".");

        if (segments.length === 2) {
            state.kabupaten.push({ code: item.code, name: item.name });
        } else if (segments.length === 3) {
            const kabCode = `${segments[0]}.${segments[1]}`;
            if (!state.kecByKab.has(kabCode)) {
                state.kecByKab.set(kabCode, []);
            }
            state.kecByKab.get(kabCode).push({
                code: item.code,
                name: item.name,
            });
        } else if (segments.length === 4) {
            const kecCode = `${segments[0]}.${segments[1]}.${segments[2]}`;
            if (!state.desaByKec.has(kecCode)) {
                state.desaByKec.set(kecCode, []);
            }
            state.desaByKec.get(kecCode).push({
                code: item.code,
                name: item.name,
            });
        }
    });

    state.kabupaten = sortByName(state.kabupaten);
    wilayahCache.set(provinceFile, state);
    return state;
}

async function handleProvinceChange() {
    const provinceFile = provinsiSelect.value;
    resetWilayah();
    if (!provinceFile) {
        setStatus("Pilih provinsi untuk memuat daftar wilayah.");
        return;
    }

    setStatus("Memuat daftar wilayah provinsi...");

    try {
        const state = await loadWilayahByProvince(provinceFile);
        fillSelect(kabupatenSelect, state.kabupaten, "Pilih kabupaten/kota");
        kabupatenSelect.disabled = false;
        kabupatenSelect.dataset.province = provinceFile;
        setStatus("Daftar wilayah siap. Pilih kabupaten/kota.");
    } catch (error) {
        setStatus(
            "Gagal memuat daftar wilayah. Masukkan kode adm4 manual.",
            true
        );
    }
}

async function fetchWeather() {
    const adm4 = adm4Input.value.trim();
    if (!adm4) {
        setStatus("Masukkan kode wilayah adm4 dulu.", true);
        return;
    }

    btnFetch.disabled = true;
    setStatus("Mengambil data dari BMKG...");

    try {
        const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Gagal mengambil data. Coba lagi.");
        }

        const payload = await response.json();
        const forecastItems = extractForecast(payload);

        if (!forecastItems.length) {
            setStatus("Data kosong. Pastikan kode adm4 benar.", true);
            renderForecast([]);
            return;
        }

        renderSummary(forecastItems[0]);
        renderForecast(forecastItems);
        setStatus(`Menampilkan ${forecastItems.length} data prakiraan.`);
    } catch (error) {
        setStatus(error.message || "Terjadi kesalahan.", true);
    } finally {
        btnFetch.disabled = false;
    }
}

provinsiSelect.addEventListener("change", handleProvinceChange);

kabupatenSelect.addEventListener("change", () => {
    const kabCode = kabupatenSelect.value;
    const provinceFile = kabupatenSelect.dataset.province;
    const state = wilayahCache.get(provinceFile);
    const kecamatan = kabCode
        ? sortByName(state?.kecByKab.get(kabCode) || [])
        : [];
    fillSelect(kecamatanSelect, kecamatan, "Pilih kecamatan");
    kecamatanSelect.disabled = !kecamatan.length;
    fillSelect(desaSelect, [], "Pilih desa/kelurahan");
    desaSelect.disabled = true;
    adm4Input.value = "";
    adm4Hint.textContent =
        "Pilih kecamatan lalu desa/kelurahan untuk mengisi kode otomatis.";
});

kecamatanSelect.addEventListener("change", () => {
    const kecCode = kecamatanSelect.value;
    const provinceFile = kabupatenSelect.dataset.province;
    const state = wilayahCache.get(provinceFile);
    const desa = kecCode
        ? sortByName(state?.desaByKec.get(kecCode) || [])
        : [];
    fillSelect(desaSelect, desa, "Pilih desa/kelurahan");
    desaSelect.disabled = !desa.length;
    adm4Input.value = "";
});

desaSelect.addEventListener("change", () => {
    const desaCode = desaSelect.value;
    if (!desaCode) return;
    adm4Input.value = desaCode;
    // adm4Hint.textContent = ``;
});

btnFetch.addEventListener("click", fetchWeather);
adm4Input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") fetchWeather();
});

const btnLocation = document.getElementById("btnLocation");

btnLocation.addEventListener("click", () => {
    // Check for Secure Context (HTTPS or localhost)
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const isSecure = window.location.protocol === "https:";

    if (!isLocalhost && !isSecure) {
        setStatus("Gagal: GPS butuh HTTPS atau localhost. Coba di laptop ini saja.", false);
        alert("Fitur lokasi (GPS) diblokir browser karena tidak menggunakan HTTPS. Silakan pilih wilayah secara manual atau buka di localhost.");
        return;
    }

    if (!navigator.geolocation) {
        setStatus("Geolocation tidak didukung browser ini.", true);
        return;
    }

    setStatus("Mencari lokasi...");
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const {
                latitude,
                longitude,
                accuracy
            } = position.coords;
            const accText = accuracy ? ` (akurasi ~${Math.round(accuracy)}m)` : "";
            setStatus(`Lokasi ditemukan: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}${accText}. Mencari wilayah...`);

            try {
                // Reverse Geocoding with Nominatim
                const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`;
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'WeatherApp/1.0'
                    }
                });
                if (!response.ok) throw new Error("Gagal mengambil data lokasi.");
                const data = await response.json();

                const address = data.address;
                const provinceName = address.state || address.region; // Nominatim varies
                const cityName =
                    address.city ||
                    address.town ||
                    address.county ||
                    address.municipality ||
                    address.regency;
                const districtName =
                    address.city_district ||
                    address.district ||
                    address.subdistrict ||
                    address.suburb ||
                    address.quarter;
                const villageName =
                    address.village ||
                    address.hamlet ||
                    address.neighbourhood ||
                    address.locality ||
                    address.quarter ||
                    address.suburb;

                const displayName = data.display_name || "";
                const displayParts = displayName
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean);
                const displayFirst = displayParts[0] || "";
                const displaySecond = displayParts[1] || "";

                if (!provinceName) throw new Error("Provinsi tidak ditemukan.");

                // Determine province file code
                let provinceCode = "";
                const opts = Array.from(provinsiSelect.options);
                const normalizeProv = (value) => {
                    return value
                        .toLowerCase()
                        .replace(/\bspecial region of\b/g, "")
                        .replace(/\b(daerah istimewa|d\.i\.|di)\b/g, "")
                        .replace(/\b(dki|jakarta)\b/g, "jakarta")
                        .replace(/\bjawa\b/g, "")
                        .replace(/\s+/g, " ")
                        .trim();
                };

                // Simple fuzzy match or includes with normalization
                const targetProv = opts.find((opt) => {
                    const optNorm = normalizeProv(opt.text);
                    const provNorm = normalizeProv(provinceName);
                    if (!optNorm || !provNorm) return false;
                    return optNorm.includes(provNorm) || provNorm.includes(optNorm);
                });

                const normalizeName = (value) => {
                    return value
                        .toLowerCase()
                        .replace(/\b(kab\.?|kabupaten|kota)\b/g, "")
                        .replace(/\b(regency)\b/g, "")
                        .replace(/\b(kab\.)\b/g, "")
                        .replace(/\b(kec\.?|kecamatan)\b/g, "")
                        .replace(/\b(desa|kelurahan|kel\.)\b/g, "")
                        .replace(/[^\p{L}\p{N}\s]/gu, " ")
                        .replace(/\s+/g, " ")
                        .trim();
                };

                if (targetProv) {
                    provinceCode = targetProv.value;
                    provinsiSelect.value = provinceCode;
                    await handleProvinceChange(); // Load kabupatens

                    // Start filtering down
                    if (cityName) {
                        // Find kabupaten
                        const kabOpts = Array.from(kabupatenSelect.options);
                        // Cleaning up "Kota" or "Kabupaten" prefix if needed, though usually Nominatim gives just the name or with type.
                        // Our data has "KAB. ..." or "KOTA ..."
                        const cityNorm = normalizeName(cityName);
                        const targetKab = kabOpts.find((opt) => {
                            const optNorm = normalizeName(opt.text);
                            return optNorm.includes(cityNorm) || cityNorm.includes(optNorm);
                        });

                        if (targetKab) {
                            kabupatenSelect.value = targetKab.value;
                            // Trigger change manually to load kecamatans
                            kabupatenSelect.dispatchEvent(new Event('change'));

                            // Wait for kecamatans (since it's sync in event listener but relies on cache... wait, event listener for kabupaten is sync but loads from cache? Yes cache is loaded in handleProvinceChange. But the event listener logic is:
                            //  const kecamatan = kabCode ? sortByName(state?.kecByKab.get(kabCode) || []) : [];
                            // fillSelect...
                            // So it is synchronous.

                            // Now find kecamatan
                            const kecOpts = Array.from(kecamatanSelect.options);
                            const districtCandidates = [
                                districtName,
                                address.city_district,
                                address.district,
                                address.subdistrict,
                                address.municipality,
                                address.suburb,
                                address.quarter,
                                address.neighbourhood,
                                displaySecond,
                                cityName, // fallback when kab/kec name identical (e.g., Sleman)
                            ].filter(Boolean);

                            let targetKec;
                            for (const cand of districtCandidates) {
                                const distNorm = normalizeName(cand);
                                if (!distNorm) continue;
                                targetKec = kecOpts.find((opt) => {
                                    const optNorm = normalizeName(opt.text);
                                    return optNorm.includes(distNorm) || distNorm.includes(optNorm);
                                });
                                if (targetKec) break;
                            }

                            if (targetKec) {
                                kecamatanSelect.value = targetKec.value;
                                kecamatanSelect.dispatchEvent(new Event('change'));

                                // Now find desa
                                const desaOpts = Array.from(desaSelect.options);
                                const villageCandidates = [
                                    villageName,
                                    address.village,
                                    address.hamlet,
                                    address.neighbourhood,
                                    address.locality,
                                    address.quarter,
                                    address.suburb,
                                    displayFirst,
                                ].filter(Boolean);

                                let targetDesa;
                                for (const cand of villageCandidates) {
                                    const villNorm = normalizeName(cand);
                                    if (!villNorm) continue;
                                    targetDesa = desaOpts.find((opt) => {
                                        const optNorm = normalizeName(opt.text);
                                        return optNorm.includes(villNorm) || villNorm.includes(optNorm);
                                    });
                                    if (targetDesa) break;
                                }

                                if (targetDesa) {
                                    desaSelect.value = targetDesa.value;
                                    desaSelect.dispatchEvent(new Event('change'));
                                    setStatus(`Lokasi terdeteksi: ${targetDesa.text}, ${targetKec.text}, ${cityName}. Mengambil cuaca...`);
                                    fetchWeather(); // Auto fetch!
                                    return;
                                }
                            }
                            // If we get here, we found kab but not specific enough for auto-fetch, or desa mismatch.
                            setStatus(`Wilayah terdeteksi sampai: ${cityName}. Silakan lengkapi pilihan.`);
                        } else {
                            setStatus(`Kabupaten/Kota ${cityName} tidak ditemukan di database kami.`);
                        }
                    }
                } else {
                    setStatus(`Provinsi ${provinceName} tidak didukung atau tidak ditemukan.`);
                }


            } catch (error) {
                setStatus(`Gagal mendeteksi wilayah: ${error.message}`, true);
            }
        },
        (error) => {
            setStatus("Gagal mendapatkan lokasi. Pastikan GPS aktif.", true);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000,
        }
    );
});
